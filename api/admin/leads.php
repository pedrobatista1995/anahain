<?php
require_once dirname(__DIR__) . '/bootstrap.php';
require_get();
require_auth();

$search = trim((string)($_GET['q'] ?? ''));
$rows = [];

$sql = 'SELECT
    patient_name,
    patient_email,
    patient_phone,
    MIN(created_at) AS first_seen,
    MAX(created_at) AS last_seen,
    SUM(CASE WHEN status = "confirmed" THEN 1 ELSE 0 END) AS confirmed_count,
    SUM(CASE WHEN status = "cancelled" THEN 1 ELSE 0 END) AS cancelled_count
  FROM bookings';
$params = [];
if ($search !== '') {
    $sql .= ' WHERE patient_name LIKE :q OR patient_email LIKE :q OR patient_phone LIKE :q';
    $params[':q'] = '%' . $search . '%';
}
$sql .= ' GROUP BY lower(patient_email), patient_phone ORDER BY last_seen DESC LIMIT 2000';

$stmt = $pdo->prepare($sql);
$stmt->execute($params);
$rows = $stmt->fetchAll();

respond_json([
    'ok' => true,
    'count' => count($rows),
    'leads' => $rows
]);
