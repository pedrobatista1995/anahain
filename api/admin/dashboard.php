<?php
require_once dirname(__DIR__) . '/bootstrap.php';
require_get();
require_auth();

$month = trim((string)($_GET['month'] ?? ''));
if (!preg_match('/^\d{4}-\d{2}$/', $month)) {
    $month = date('Y-m');
}

$settings = get_settings($pdo);
$rules = get_rules_from_settings($settings);
$availability = get_weekly_availability($pdo);

$recentBookings = $pdo->query('SELECT
    id,
    patient_name,
    patient_email,
    patient_phone,
    slot_start,
    slot_end,
    status,
    cancellation_source,
    cancellation_reason,
    cancelled_at,
    created_at
  FROM bookings
  ORDER BY slot_start DESC
  LIMIT 400')->fetchAll();

$monthlyBookingsStmt = $pdo->prepare('SELECT
    id,
    patient_name,
    patient_email,
    patient_phone,
    slot_start,
    slot_end,
    status,
    cancellation_source,
    cancellation_reason,
    cancelled_at,
    created_at
  FROM bookings
  WHERE substr(slot_start, 1, 7) = :m
  ORDER BY slot_start ASC');
$monthlyBookingsStmt->execute([':m' => $month]);
$monthlyBookings = $monthlyBookingsStmt->fetchAll();

$recordRows = [];
$bookingIds = array_map('intval', array_column($recentBookings, 'id'));
if ($bookingIds) {
    $placeholders = implode(',', array_fill(0, count($bookingIds), '?'));
    $recordStmt = $pdo->prepare('SELECT
        id,
        booking_id,
        chief_complaint,
        clinical_history,
        examination_notes,
        diagnosis,
        conduct,
        prescription_text,
        follow_up,
        private_notes,
        created_at,
        updated_at
      FROM medical_records
      WHERE booking_id IN (' . $placeholders . ')
      ORDER BY updated_at DESC');
    $recordStmt->execute($bookingIds);
    $recordRows = $recordStmt->fetchAll();
}

$monthlyBookingStmt = $pdo->prepare('SELECT
    SUM(CASE WHEN status = "confirmed" THEN 1 ELSE 0 END) AS confirmed_count,
    SUM(CASE WHEN status = "cancelled" THEN 1 ELSE 0 END) AS cancelled_count
  FROM bookings
  WHERE substr(slot_start, 1, 7) = :m');
$monthlyBookingStmt->execute([':m' => $month]);
$monthlyBooking = $monthlyBookingStmt->fetch() ?: [];

$monthlyEventsStmt = $pdo->prepare('SELECT event_name, SUM(metric_value) AS total
  FROM metric_events
  WHERE year_month = :m
  GROUP BY event_name');
$monthlyEventsStmt->execute([':m' => $month]);
$monthlyEvents = [];
foreach ($monthlyEventsStmt->fetchAll() as $row) {
    $monthlyEvents[$row['event_name']] = (int)$row['total'];
}

$seriesRows = $pdo->query('SELECT year_month,
    SUM(CASE WHEN event_name = "booking_confirmed" THEN metric_value ELSE 0 END) AS booking_confirmed,
    SUM(CASE WHEN event_name = "booking_cancelled" THEN metric_value ELSE 0 END) AS booking_cancelled,
    SUM(CASE WHEN event_name = "click_instagram" THEN metric_value ELSE 0 END) AS click_instagram,
    SUM(CASE WHEN event_name = "click_google_business" THEN metric_value ELSE 0 END) AS click_google_business
  FROM metric_events
  GROUP BY year_month
  ORDER BY year_month DESC
  LIMIT 12')->fetchAll();

$leadTotalStmt = $pdo->query('SELECT COUNT(*) FROM (
  SELECT lower(patient_email), patient_phone FROM bookings GROUP BY lower(patient_email), patient_phone
)');
$leadTotal = (int)$leadTotalStmt->fetchColumn();

$allBlocks = get_day_blocks($pdo);
$monthlyBlockMap = [];
foreach ($allBlocks as $block) {
    if (substr((string)$block['block_date'], 0, 7) === $month) {
        $monthlyBlockMap[(string)$block['block_date']] = $block;
    }
}

$dailySummary = [];
foreach ($monthlyBookings as $booking) {
    $dateKey = substr((string)$booking['slot_start'], 0, 10);
    if (!isset($dailySummary[$dateKey])) {
        $dailySummary[$dateKey] = [
            'confirmed_count' => 0,
            'cancelled_count' => 0,
            'bookings_count' => 0,
        ];
    }
    $dailySummary[$dateKey]['bookings_count']++;
    if ((string)$booking['status'] === 'confirmed') {
        $dailySummary[$dateKey]['confirmed_count']++;
    } elseif ((string)$booking['status'] === 'cancelled') {
        $dailySummary[$dateKey]['cancelled_count']++;
    }
}

$tz = new DateTimeZone($rules['timezone']);
$monthStart = DateTimeImmutable::createFromFormat('!Y-m-d', $month . '-01', $tz);
if (!$monthStart) {
    $monthStart = new DateTimeImmutable('first day of this month', $tz);
}
$monthEnd = $monthStart->modify('last day of this month');
$calendarDays = [];
$cursor = $monthStart;
while ($cursor <= $monthEnd) {
    $dateKey = $cursor->format('Y-m-d');
    $stats = $dailySummary[$dateKey] ?? [
        'confirmed_count' => 0,
        'cancelled_count' => 0,
        'bookings_count' => 0,
    ];
    $block = $monthlyBlockMap[$dateKey] ?? null;
    $capacity = compute_day_capacity($pdo, $dateKey, $rules, $availability, $monthlyBlockMap);

    $calendarDays[] = [
        'date_key' => $dateKey,
        'day_number' => (int)$cursor->format('j'),
        'weekday' => (int)$cursor->format('w'),
        'confirmed_count' => (int)$stats['confirmed_count'],
        'cancelled_count' => (int)$stats['cancelled_count'],
        'bookings_count' => (int)$stats['bookings_count'],
        'capacity' => $capacity,
        'remaining_count' => max(0, $capacity - (int)$stats['confirmed_count']),
        'is_blocked' => $block !== null,
        'block_reason' => $block['reason'] ?? '',
    ];

    $cursor = $cursor->modify('+1 day');
}

respond_json([
    'ok' => true,
    'report_month' => $month,
    'settings' => [
        'clinic_name' => $settings['clinic_name'] ?? 'Tricologia',
        'doctor_name' => $settings['doctor_name'] ?? 'Médico',
        'doctor_whatsapp' => $settings['doctor_whatsapp'] ?? '',
        'doctor_email' => $settings['doctor_email'] ?? '',
        'public_base_url' => $settings['public_base_url'] ?? '',
        'smtp_host' => $settings['smtp_host'] ?? '',
        'smtp_port' => (int)($settings['smtp_port'] ?? 587),
        'smtp_username' => $settings['smtp_username'] ?? '',
        'smtp_password' => $settings['smtp_password'] ?? '',
        'smtp_encryption' => $settings['smtp_encryption'] ?? 'tls',
        'smtp_from_email' => $settings['smtp_from_email'] ?? '',
        'smtp_from_name' => $settings['smtp_from_name'] ?? 'Tricologia',
        'cancellation_reasons' => $settings['cancellation_reasons'] ?? '',
        'rules' => $rules
    ],
    'availability' => array_values($availability),
    'bookings' => $recentBookings,
    'monthly_bookings' => $monthlyBookings,
    'day_blocks' => $allBlocks,
    'records' => $recordRows,
    'calendar_days' => $calendarDays,
    'metrics' => load_metrics($pdo),
    'monthly' => [
        'confirmed_count' => (int)($monthlyBooking['confirmed_count'] ?? 0),
        'cancelled_count' => (int)($monthlyBooking['cancelled_count'] ?? 0),
        'click_instagram' => (int)($monthlyEvents['click_instagram'] ?? 0),
        'click_google_business' => (int)($monthlyEvents['click_google_business'] ?? 0),
        'total_leads' => $leadTotal,
    ],
    'monthly_series' => $seriesRows,
]);
