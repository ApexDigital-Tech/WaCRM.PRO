<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, access-token, Access-Token, accept');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$chromeStoreID = $_GET['chromeStoreID'] ?? '';

echo json_encode([
    'success' => true,
    'msg_id' => 'initial_data_success',
    'chromeStoreID' => $chromeStoreID,
    'backend' => 'https://pulsocrm.letaldigital.lat/',
    'update' => [
        'enabled' => true,
    ],
    'webhooks' => [],
    'meet' => (object) [],
    'migration' => (object) [],
    'urls' => (object) [],
], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
