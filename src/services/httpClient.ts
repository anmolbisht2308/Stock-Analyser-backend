import axios from "axios";

export const http = axios.create({
  timeout: 15_000,
  headers: {
    "User-Agent": "stock-analysis-backend/1.0",
    Accept: "application/json",
  },
});

