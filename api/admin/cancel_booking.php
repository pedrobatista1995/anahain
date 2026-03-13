<?php
require_once dirname(__DIR__) . '/bootstrap.php';
require_post();
require_auth();

$payload = request_json();
$bookingId = (int)($payload['booking_id'] ?? 0);
$reason = trim((string)($payload['reason'] ?? 'Cancelado pela clinica.'));
if ($reason === '') {
    $reason = 'Cancelado pela clinica.';
}

if ($bookingId <= 0) {
    respond_json(['ok' => false, 'message' => 'ID de consulta invalido.'], 422);
}

$stmt = $pdo->prepare('SELECT id, patient_name, patient_email, slot_start, status FROM bookings WHERE id = :id LIMIT 1');
$stmt->execute([':id' => $bookingId]);
$booking = $stmt->fetch();
if (!$booking) {
    respond_json(['ok' => false, 'message' => 'Consulta nao encontrada.'], 404);
}
if ((string)$booking['status'] !== 'confirmed') {
    respond_json(['ok' => false, 'message' => 'Consulta ja esta cancelada.'], 409);
}

cancel_booking_with_notification($pdo, $booking, $reason, 'doctor');

respond_json(['ok' => true, 'message' => 'Consulta cancelada e paciente notificado por e-mail.']);
