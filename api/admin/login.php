<?php
require_once dirname(__DIR__) . '/bootstrap.php';
require_post();

$payload = request_json();
$username = trim((string)($payload['username'] ?? ''));
$password = (string)($payload['password'] ?? '');
$ip = get_client_ip();

block_if_rate_limited($pdo, $ip);
register_login_attempt($pdo, $ip);

if ($username === '' || $password === '') {
    respond_json(['ok' => false, 'message' => 'Informe usuario e senha.'], 422);
}

$stmt = $pdo->prepare('SELECT username, password_hash FROM users WHERE username = :u LIMIT 1');
$stmt->execute([':u' => $username]);
$user = $stmt->fetch();

if (!$user || !password_verify($password, $user['password_hash'])) {
    respond_json(['ok' => false, 'message' => 'Credenciais invalidas.'], 401);
}

session_regenerate_id(true);
$_SESSION['admin_user'] = $user['username'];

respond_json(['ok' => true, 'username' => $user['username']]);
