<?php
require_once dirname(__DIR__) . '/bootstrap.php';
require_get();

respond_json([
    'ok' => true,
    'authenticated' => !empty($_SESSION['admin_user']),
    'username' => $_SESSION['admin_user'] ?? null
]);
