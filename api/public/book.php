<?php
require_once dirname(__DIR__) . '/bootstrap.php';
require_post();

$payload = request_json();
$name = trim((string)($payload['name'] ?? ''));
$email = trim((string)($payload['email'] ?? ''));
$phone = sanitize_phone((string)($payload['phone'] ?? ''));
$slotStart = trim((string)($payload['slot_start'] ?? ''));

if ($name === '' || $email === '' || $phone === '' || $slotStart === '') {
    respond_json(['ok' => false, 'message' => 'Informe nome, e-mail, telefone e horario.'], 422);
}
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    respond_json(['ok' => false, 'message' => 'E-mail invalido.'], 422);
}

$settings = get_settings($pdo);
$rules = get_rules_from_settings($settings);

if (!is_slot_allowed($pdo, $slotStart, $rules)) {
    $dupe = $pdo->prepare('SELECT id, created_at FROM bookings WHERE patient_email = :e AND slot_start = :s AND status = "confirmed" ORDER BY id DESC LIMIT 1');
    $dupe->execute([':e' => $email, ':s' => $slotStart]);
    $dupeRow = $dupe->fetch();
    if ($dupeRow) {
        respond_json(['ok' => true, 'message' => 'Consulta ja estava confirmada para este horario.']);
    }
    respond_json(['ok' => false, 'message' => 'Horario indisponivel ou fora das regras.'], 409);
}

$slotDate = DateTimeImmutable::createFromFormat(DateTimeInterface::ATOM, $slotStart);
if (!$slotDate) {
    respond_json(['ok' => false, 'message' => 'Formato de horario invalido.'], 422);
}
$slotEnd = $slotDate->modify('+' . $rules['slot_duration_minutes'] . ' minutes');

try {
    $ins = $pdo->prepare('INSERT INTO bookings (patient_name, patient_email, patient_phone, slot_start, slot_end, status, cancel_token_hash, cancel_expires_at, created_at)
      VALUES (:n,:m,:p,:s,:e,"confirmed",:h,:x,:c)');
    $ins->execute([
        ':n' => $name,
        ':m' => $email,
        ':p' => $phone,
        ':s' => $slotDate->format('c'),
        ':e' => $slotEnd->format('c'),
        ':h' => '',
        ':x' => '',
        ':c' => date('c'),
    ]);
} catch (Throwable $e) {
    respond_json(['ok' => false, 'message' => 'Este horario acabou de ser reservado.'], 409);
}

increment_metric($pdo, 'booking_confirmed', 1);
increment_metric($pdo, 'total_bookings', 1);

$doctorWhats = sanitize_phone((string)($settings['doctor_whatsapp'] ?? ''));
$doctorEmail = trim((string)($settings['doctor_email'] ?? ''));
$clinicName = trim((string)($settings['clinic_name'] ?? 'Tricologia'));
$doctorName = trim((string)($settings['doctor_name'] ?? 'Medico'));

$dayLabel = $slotDate->setTimezone(new DateTimeZone($rules['timezone']))->format('d/m/Y H:i');
$msg = "*Mensagem Agendamento Automatico:*\n" .
  "*Paciente:* {$name}\n" .
  "*Email:* {$email}\n" .
  "*Dia/Horario:* {$dayLabel}\n" .
  "*Numero:* {$phone}";
$whatsUrl = $doctorWhats !== '' ? ('https://wa.me/' . $doctorWhats . '?text=' . rawurlencode($msg)) : '';

$patientSubject = 'Confirmacao de consulta - ' . $clinicName;
$patientBody = "Ola, {$name}.\n\n" .
    "Sua consulta foi confirmada.\n" .
    "Data/Horario: {$dayLabel}\n" .
    "Profissional: {$doctorName}\n\n" .
    "Para cancelar ou reagendar, fale com a clinica no WhatsApp.\n";

send_email($email, $patientSubject, $patientBody, $doctorEmail ?: null);

if ($doctorEmail !== '') {
    $doctorSubject = 'Novo agendamento - ' . $clinicName;
    $doctorBody = "Novo agendamento confirmado.\n\n" .
        "Paciente: {$name}\n" .
        "Email: {$email}\n" .
        "WhatsApp: {$phone}\n" .
        "Data/Horario: {$dayLabel}\n";
    send_email($doctorEmail, $doctorSubject, $doctorBody, null);
}

respond_json([
    'ok' => true,
    'message' => 'Consulta agendada com sucesso.',
    'booking' => [
        'name' => $name,
        'email' => $email,
        'phone' => $phone,
        'slot_start' => $slotDate->format('c')
    ],
    'doctor_whatsapp_url' => $whatsUrl
]);
