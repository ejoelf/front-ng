<?php
header('Content-Type: application/json; charset=utf-8');

// ===============================
// 🔥 PHPMailer
// ===============================
use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

require __DIR__ . '/PHPMailer/src/Exception.php';
require __DIR__ . '/PHPMailer/src/PHPMailer.php';
require __DIR__ . '/PHPMailer/src/SMTP.php';

// ===============================
// 🚫 SOLO POST
// ===============================
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  http_response_code(405);
  echo json_encode(['ok' => false]);
  exit;
}

// ===============================
// 📥 DATA
// ===============================
$name    = trim($_POST['name'] ?? '');
$email   = trim($_POST['email'] ?? '');
$message = trim($_POST['message'] ?? '');

// ===============================
// 🔍 VALIDACIÓN
// ===============================
if (!$name || !$email || !$message) {
  echo json_encode(['ok' => false, 'message' => 'Datos incompletos']);
  exit;
}

// ===============================
// 🚀 MAILER
// ===============================
$mail = new PHPMailer(true);

try {
  // ===============================
  // 🔐 SMTP HOSTINGER
  // ===============================
  $mail->isSMTP();
  $mail->Host       = 'smtp.hostinger.com';
  $mail->SMTPAuth   = true;
  $mail->Username   = 'contacto@nicogaliciastylistmens.com';
  $mail->Password   = 'Nicolas.Galicia.2026'; // 👈 PEGÁ TU PASSWORD
  $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
  $mail->Port       = 587;

  // ===============================
  // ✉️ CONFIG EMAIL
  // ===============================
  $mail->setFrom('contacto@nicogaliciastylistmens.com', 'Web NG');
  $mail->addAddress('contacto@nicogaliciastylistmens.com');

  // responder al cliente
  $mail->addReplyTo($email, $name);

  // ===============================
  // 📝 CONTENIDO
  // ===============================
  $mail->isHTML(false);
  $mail->Subject = 'Nuevo mensaje desde la web';

  $mail->Body = "Nuevo mensaje:\n\n"
    . "Nombre: $name\n"
    . "Email: $email\n\n"
    . "Mensaje:\n$message\n";

  // ===============================
  // 📤 ENVIAR
  // ===============================
  $mail->send();

  echo json_encode(['ok' => true]);

} catch (Exception $e) {
  echo json_encode([
    'ok' => false,
    'message' => $mail->ErrorInfo
  ]);
}