<?php
// send-mail.php
header('Content-Type: application/json; charset=utf-8');

// Permitir solo POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  http_response_code(405);
  echo json_encode([
    'ok' => false,
    'message' => 'Método no permitido'
  ]);
  exit;
}

// Honeypot anti-bots (si viene lleno, simulamos OK)
$company = trim($_POST['company'] ?? '');
if ($company !== '') {
  echo json_encode(['ok' => true]);
  exit;
}

$name = trim($_POST['name'] ?? '');
$email = trim($_POST['email'] ?? '');
$message = trim($_POST['message'] ?? '');

function is_valid_email($email) {
  return filter_var($email, FILTER_VALIDATE_EMAIL) !== false;
}

function clean_header_value($value) {
  // Evita header injection básica
  $value = str_replace(["\r", "\n"], ' ', $value);
  return trim($value);
}

$errors = [];

if ($name === '' || mb_strlen($name) < 2) {
  $errors[] = 'Nombre inválido';
}

if ($email === '' || !is_valid_email($email)) {
  $errors[] = 'Email inválido';
}

if ($message === '' || mb_strlen($message) < 10) {
  $errors[] = 'Mensaje muy corto';
}

if (!empty($errors)) {
  http_response_code(400);
  echo json_encode([
    'ok' => false,
    'message' => 'Revisá los datos e intentá de nuevo.'
  ]);
  exit;
}

// ⚠️ CAMBIAR ESTO por el mail real de Nicolás
$TO_EMAIL = 'nicogalicia1@gmail.com';

// Host seguro (sin puerto, sin www)
$rawHost = $_SERVER['HTTP_HOST'] ?? 'tudominio.com';
$host = preg_replace('/:\d+$/', '', $rawHost);
$host = preg_replace('/^www\./i', '', $host);

// Validación simple del host para usarlo en el remitente
if (!preg_match('/^[a-z0-9.-]+\.[a-z]{2,}$/i', $host)) {
  $host = 'tudominio.com';
}

// Ideal: usar un remitente del mismo dominio para que Hostinger no lo rechace
$from = 'no-reply@' . $host;

$safeName = clean_header_value($name);
$safeEmail = clean_header_value($email);

$subject = 'Nuevo mensaje desde la web - ' . $safeName;

$body = "Nuevo mensaje desde la web:\n\n";
$body .= "Nombre: {$name}\n";
$body .= "Email: {$email}\n\n";
$body .= "Mensaje:\n{$message}\n\n";
$body .= "IP: " . ($_SERVER['REMOTE_ADDR'] ?? '-') . "\n";
$body .= "Fecha: " . date('Y-m-d H:i:s') . "\n";

$headers = [];
$headers[] = "From: {$from}";
$headers[] = "Reply-To: {$safeEmail}";
$headers[] = "Content-Type: text/plain; charset=UTF-8";

$ok = @mail($TO_EMAIL, $subject, $body, implode("\r\n", $headers));

if (!$ok) {
  http_response_code(500);
  echo json_encode([
    'ok' => false,
    'message' => 'No se pudo enviar el email desde el servidor.'
  ]);
  exit;
}

echo json_encode(['ok' => true]);