<?php
require_once dirname(__DIR__) . '/bootstrap.php';
require_post();

$payload = request_json();
$event = trim((string)($payload['event'] ?? ''));
$allowed = [
    'click_agendar',
    'click_whatsapp',
    'click_instagram',
    'click_google_reviews',
    'click_google_business',
    'view_calendar',
    'select_slot'
];
if ($event === '' || !in_array($event, $allowed, true)) {
    respond_json(['ok' => false, 'message' => 'Evento invalido'], 422);
}

increment_metric($pdo, $event, 1);
respond_json(['ok' => true]);
