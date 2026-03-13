<?php
require_once dirname(__DIR__) . '/bootstrap.php';
require_post();
require_auth();

$pdo->exec('DELETE FROM metrics');
respond_json(['ok' => true]);
