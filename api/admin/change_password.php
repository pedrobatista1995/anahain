<?php
require_once dirname(__DIR__) . '/bootstrap.php';
require_post();
require_auth();

$payload = request_json();
$current = (string)($payload['current_password'] ?? '');
$newPassword = (string)($payload['new_password'] ?? '');

if (strlen($newPassword) < 10) {
    respond_json(['ok' => false, 'message' => 'Nova senha precisa ter ao menos 10 caracteres.'], 422);
}

$stmt = $pdo->prepare('SELECT password_hash FROM users WHERE username = :u LIMIT 1');
$stmt->execute([':u' => $_SESSION['admin_user']]);
$row = $stmt->fetch();
if (!$row || !password_verify($current, $row['password_hash'])) {
    respond_json(['ok' => false, 'message' => 'Senha atual invalida.'], 401);
}

$hash = password_hash($newPassword, PASSWORD_DEFAULT);
$upd = $pdo->prepare('UPDATE users SET password_hash = :p WHERE username = :u');
$upd->execute([':p' => $hash, ':u' => $_SESSION['admin_user']]);

respond_json(['ok' => true]);
