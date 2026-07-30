<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, access-token, Access-Token, accept");
header("Content-Type: application/json; charset=utf-8");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true) ?: [];

$email = trim($input['email'] ?? '');
$access_token_plugin = $input['access_token_plugin'] ?? ($input['token'] ?? '');
$chromeStoreID = $input['chromeStoreID'] ?? ($_GET['chromeStoreID'] ?? '');

if ($email === '') {
    echo json_encode(["success" => false, "msg_id" => "missing_fields", "message" => "email es requerido"]);
    exit;
}

$conn = new mysqli("localhost", "wpres_wacrm", "G]-.V2d6+VxA", "wpres_wacrm");
if ($conn->connect_error) {
    echo json_encode(["success" => false, "msg_id" => "db_connection_error", "message" => $conn->connect_error]);
    exit;
}

$stmt = $conn->prepare("SELECT id,email,license_key,act_date,end_date,plan_type,chrome_store_id,token FROM users WHERE email=? LIMIT 1");
$stmt->bind_param("s", $email);
$stmt->execute();
$res = $stmt->get_result();

if ($res->num_rows !== 1) {
    echo json_encode(["success" => false, "msg_id" => "invalid_user", "message" => "Usuario no encontrado"]);
    $stmt->close();
    $conn->close();
    exit;
}

$user = $res->fetch_assoc();

// Evita botar al usuario por login_duplicado cuando Chrome/extension manda otro ID.
// Si el usuario no tiene chrome_store_id guardado, lo registramos; si ya tiene otro,
// no bloqueamos la sesión porque la validación real debe ser email + token + licencia.
if ($chromeStoreID !== '' && empty($user['chrome_store_id'])) {
    $update = $conn->prepare("UPDATE users SET chrome_store_id=? WHERE id=?");
    $userId = (int) $user['id'];
    $update->bind_param("si", $chromeStoreID, $userId);
    $update->execute();
    $update->close();
}

if ($access_token_plugin !== '') {
    if (empty($user['token']) || !hash_equals($user['token'], $access_token_plugin)) {
        echo json_encode(["success" => false, "msg_id" => "invalid_token_in_validation", "message" => "Token inválido"]);
        $stmt->close();
        $conn->close();
        exit;
    }
}

$active = !empty($user['end_date']) && strtotime($user['end_date']) > time();
$user_status = $active ? "active" : "expired";
$data_liberacao = !empty($user['act_date']) ? $user['act_date'] : date("Y-m-d");

echo json_encode([
    "success" => $active,
    "msg_id" => $active ? "validacao_successo" : "licenca_expirada",
    "message" => $active ? "OK" : "Licencia expirada",
    "auth_google" => ["active" => false, "email_auth" => null],
    "user_status" => $user_status,
    "user" => [
        "id" => (int) $user['id'],
        "user_id" => (int) $user['id'],
        "name" => $user['email'],
        "email" => $user['email'],
        "wl_id" => $chromeStoreID,
        "license_key" => $user['license_key'],
        "end_date" => $user['end_date'],
        "plan_type" => $user['plan_type'],
        "bearer_token" => "",
        "access_token_plugin" => $user['token'] ?? $access_token_plugin,
        "user_premium" => $active,
        "dataCadastro" => $data_liberacao,
        "whatsapp_registro" => "",
        "whatsapp_plugin" => "",
        "path" => "",
        "afiliado" => "",
        "campanhaID" => "",
        "start_form" => false,
        "cookies" => [
            "_fbc" => "",
            "_fbp" => "",
            "_ga" => "",
            "_ttclid" => "",
            "_ttp" => "",
        ],
    ],
], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

$stmt->close();
$conn->close();
