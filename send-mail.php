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

$name    = trim($_POST['name']    ?? '');
$email   = trim($_POST['email']   ?? '');
$message = trim($_POST['message'] ?? '');

function is_valid_email($email) {
  return filter_var($email, FILTER_VALIDATE_EMAIL) !== false;
}

function clean_header_value($value) {
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
    'ok'      => false,
    'message' => 'Revisá los datos e intentá de nuevo.'
  ]);
  exit;
}

// ✅ Destinatario final: Gmail de Nico
$TO_EMAIL = 'nicogalicia1@gmail.com';

// ✅ Remitente: email del dominio propio (evita spam)
// Al venir de contacto@nicogaliciastylistmens.com Hostinger lo firma con SPF/DKIM
// y Gmail lo acepta como legítimo en vez de mandarlo a spam.
$FROM_EMAIL = 'contacto@nicogaliciastylistmens.com';
$FROM_NAME  = 'NG Stylist Mens Web';

$safeName  = clean_header_value($name);
$safeEmail = clean_header_value($email);

$subject = 'Nuevo mensaje desde la web - ' . $safeName;

$body  = "Nuevo mensaje recibido desde nicogaliciastylistmens.com:\n\n";
$body .= "Nombre:  {$name}\n";
$body .= "Email:   {$email}\n\n";
$body .= "Mensaje:\n{$message}\n\n";
$body .= "---\n";
$body .= "IP:    " . ($_SERVER['REMOTE_ADDR'] ?? '-') . "\n";
$body .= "Fecha: " . date('Y-m-d H:i:s') . "\n";

// ✅ Headers correctos:
// - From: usa el email del dominio → Hostinger aplica SPF y DKIM → no va a spam
// - Reply-To: el email del visitante → cuando Nico responde, le llega al cliente
$headers   = [];
$headers[] = "From: {$FROM_NAME} <{$FROM_EMAIL}>";
$headers[] = "Reply-To: {$safeName} <{$safeEmail}>";
$headers[] = "Content-Type: text/plain; charset=UTF-8";
$headers[] = "X-Mailer: PHP/" . phpversion();

$ok = @mail($TO_EMAIL, $subject, $body, implode("\r\n", $headers));

if (!$ok) {
  http_response_code(500);
  echo json_encode([
    'ok'      => false,
    'message' => 'No se pudo enviar el email desde el servidor.'
  ]);
  exit;
}

echo json_encode(['ok' => true]);