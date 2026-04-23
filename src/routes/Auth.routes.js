import { Router } from "express";

import { login, logout } from "../controllers/Auth.controller.js";

const router = Router();

router.post('/login', login);
router.post('/logout', logout);

export default router;