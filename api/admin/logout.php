<?php
require_once dirname(__DIR__) . '/bootstrap.php';
require_post();

session_unset();
session_destroy();
respond_json(['ok' => true]);
