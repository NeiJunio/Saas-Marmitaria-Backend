import { Router } from "express";

import { buscarDashboard } from "../controllers/Dashboard.Controller.js";
import { verifyToken } from "../middlewares/verifyToken.js";

const router = Router();

router.use(verifyToken);
router.get("/", buscarDashboard);

export default router;
