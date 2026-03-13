<?php
require_once dirname(__DIR__) . '/bootstrap.php';
require_post();
require_auth();

$payload = request_json();
$dateKey = trim((string)($payload['block_date'] ?? ''));

if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $dateKey)) {
    respond_json(['ok' => false, 'message' => 'Data inválida para liberar a agenda.'], 422);
}

$stmt = $pdo->prepare('DELETE FROM schedule_blocks WHERE block_date = :d');
$stmt->execute([':d' => $dateKey]);

respond_json([
    'ok' => true,
    'message' => 'Dia liberado para novos agendamentos.',
]);
