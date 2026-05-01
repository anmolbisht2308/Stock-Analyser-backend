import { Router } from "express";
import { getScreener } from "../controllers/screener.controller";

const router = Router();

router.get("/", getScreener);

export default router;
