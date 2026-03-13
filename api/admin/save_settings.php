<?php
require_once dirname(__DIR__) . '/bootstrap.php';
require_post();
require_auth();

$payload = request_json();
$current = get_settings($pdo);

$duration = array_key_exists('slot_duration_minutes', $payload)
    ? max(10, min(240, (int)$payload['slot_duration_minutes']))
    : max(10, min(240, (int)($current['slot_duration_minutes'] ?? 60)));
$minNotice = array_key_exists('min_notice_hours', $payload)
    ? max(0, min(72, (int)$payload['min_notice_hours']))
    : max(0, min(72, (int)($current['min_notice_hours'] ?? 4)));
$maxDays = array_key_exists('max_days_ahead', $payload)
    ? max(1, min(365, (int)$payload['max_days_ahead']))
    : max(1, min(365, (int)($current['max_days_ahead'] ?? 120)));

$timezone = array_key_exists('timezone', $payload)
    ? trim((string)$payload['timezone'])
    : trim((string)($current['timezone'] ?? 'America/Sao_Paulo'));
$clinicName = array_key_exists('clinic_name', $payload)
    ? trim((string)$payload['clinic_name'])
    : trim((string)($current['clinic_name'] ?? 'Tricologia'));
$doctorName = array_key_exists('doctor_name', $payload)
    ? trim((string)$payload['doctor_name'])
    : trim((string)($current['doctor_name'] ?? 'Médico'));
$doctorWhatsapp = array_key_exists('doctor_whatsapp', $payload)
    ? sanitize_phone((string)$payload['doctor_whatsapp'])
    : sanitize_phone((string)($current['doctor_whatsapp'] ?? ''));
$doctorEmail = array_key_exists('doctor_email', $payload)
    ? trim((string)$payload['doctor_email'])
    : trim((string)($current['doctor_email'] ?? ''));
$publicBaseUrl = array_key_exists('public_base_url', $payload)
    ? trim((string)$payload['public_base_url'])
    : trim((string)($current['public_base_url'] ?? ''));
$smtpHost = array_key_exists('smtp_host', $payload)
    ? trim((string)$payload['smtp_host'])
    : trim((string)($current['smtp_host'] ?? ''));
$smtpPort = array_key_exists('smtp_port', $payload)
    ? max(1, min(65535, (int)$payload['smtp_port']))
    : max(1, min(65535, (int)($current['smtp_port'] ?? 587)));
$smtpUsername = array_key_exists('smtp_username', $payload)
    ? trim((string)$payload['smtp_username'])
    : trim((string)($current['smtp_username'] ?? ''));
$smtpPassword = array_key_exists('smtp_password', $payload)
    ? (string)$payload['smtp_password']
    : (string)($current['smtp_password'] ?? '');
$smtpEncryption = array_key_exists('smtp_encryption', $payload)
    ? strtolower(trim((string)$payload['smtp_encryption']))
    : strtolower(trim((string)($current['smtp_encryption'] ?? 'tls')));
$smtpFromEmail = array_key_exists('smtp_from_email', $payload)
    ? trim((string)$payload['smtp_from_email'])
    : trim((string)($current['smtp_from_email'] ?? ''));
$smtpFromName = array_key_exists('smtp_from_name', $payload)
    ? trim((string)$payload['smtp_from_name'])
    : trim((string)($current['smtp_from_name'] ?? 'Tricologia'));
$cancellationReasons = array_key_exists('cancellation_reasons', $payload)
    ? trim((string)$payload['cancellation_reasons'])
    : trim((string)($current['cancellation_reasons'] ?? ''));

if ($timezone === '') {
    $timezone = 'America/Sao_Paulo';
}
if ($clinicName === '') {
    $clinicName = 'Tricologia';
}
if ($doctorName === '') {
    $doctorName = 'Médico';
}
if (!in_array($smtpEncryption, ['tls', 'none'], true)) {
    $smtpEncryption = 'tls';
}

$set = $pdo->prepare('INSERT INTO app_settings (key, value) VALUES (:k,:v)
ON CONFLICT(key) DO UPDATE SET value = excluded.value');
$pairs = [
  'slot_duration_minutes' => (string)$duration,
  'min_notice_hours' => (string)$minNotice,
  'max_days_ahead' => (string)$maxDays,
  'timezone' => $timezone,
  'clinic_name' => $clinicName,
  'doctor_name' => $doctorName,
  'doctor_whatsapp' => $doctorWhatsapp,
  'doctor_email' => $doctorEmail,
  'public_base_url' => $publicBaseUrl,
  'smtp_host' => $smtpHost,
  'smtp_port' => (string)$smtpPort,
  'smtp_username' => $smtpUsername,
  'smtp_password' => $smtpPassword,
  'smtp_encryption' => $smtpEncryption,
  'smtp_from_email' => $smtpFromEmail,
  'smtp_from_name' => $smtpFromName,
  'cancellation_reasons' => $cancellationReasons,
];
foreach ($pairs as $k => $v) {
  $set->execute([':k' => $k, ':v' => $v]);
}

respond_json(['ok' => true]);
