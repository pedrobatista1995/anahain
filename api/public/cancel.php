<?php
require_once dirname(__DIR__) . '/bootstrap.php';
require_post();

$payload = request_json();
$token = trim((string)($payload['cancel_token'] ?? ''));
$email = trim((string)($payload['email'] ?? ''));

if ($token === '' || $email === '') {
    respond_json(['ok' => false, 'message' => 'Informe token e e-mail.'], 422);
}
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    respond_json(['ok' => false, 'message' => 'E-mail invalido.'], 422);
}

$hash = hash('sha256', $token);
$stmt = $pdo->prepare('SELECT id, patient_email, slot_start, status, cancel_expires_at FROM bookings WHERE cancel_token_hash = :h LIMIT 1');
$stmt->execute([':h' => $hash]);
$row = $stmt->fetch();

if (!$row) {
    respond_json(['ok' => false, 'message' => 'Token de cancelamento invalido.'], 404);
}
if (strcasecmp((string)$row['patient_email'], $email) !== 0) {
    respond_json(['ok' => false, 'message' => 'E-mail nao confere com a consulta.'], 403);
}
if ((string)$row['status'] !== 'confirmed') {
    respond_json(['ok' => false, 'message' => 'Esta consulta ja foi cancelada.'], 409);
}

$expiresAt = trim((string)($row['cancel_expires_at'] ?? ''));
if ($expiresAt !== '') {
    $exp = DateTimeImmutable::createFromFormat(DateTimeInterface::ATOM, $expiresAt);
    if ($exp && $exp < new DateTimeImmutable('now', new DateTimeZone('America/Sao_Paulo'))) {
        respond_json(['ok' => false, 'message' => 'Prazo para cancelamento online expirou.'], 409);
    }
}

$upd = $pdo->prepare('UPDATE bookings
  SET status = "cancelled",
      cancelled_at = :c,
      cancellation_source = "patient",
      cancellation_reason = "Cancelado pelo paciente"
  WHERE id = :id');
$upd->execute([':c' => date('c'), ':id' => (int)$row['id']]);

increment_metric($pdo, 'booking_cancelled', 1);

respond_json(['ok' => true, 'message' => 'Consulta cancelada com sucesso.']);
