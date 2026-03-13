<?php
require_once dirname(__DIR__) . '/bootstrap.php';
require_get();

$settings = get_settings($pdo);
$rules = get_rules_from_settings($settings);
$slots = compute_slots($pdo, $rules);

$slotsByDate = [];
foreach ($slots as $slot) {
    $key = $slot['date_key'];
    if (!isset($slotsByDate[$key])) {
        $slotsByDate[$key] = [];
    }
    $slotsByDate[$key][] = $slot;
}

respond_json([
    'ok' => true,
    'clinic' => [
        'clinic_name' => $settings['clinic_name'] ?? 'Tricologia',
        'doctor_name' => $settings['doctor_name'] ?? 'Medico',
        'doctor_whatsapp' => $settings['doctor_whatsapp'] ?? '',
    ],
    'rules' => $rules,
    'slots' => $slots,
    'slots_by_date' => $slotsByDate,
]);
