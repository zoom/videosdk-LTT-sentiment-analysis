import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import KJUR from "jsrsasign";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

dotenv.config({ quiet: true });

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, "dist");
const isProduction = process.env.NODE_ENV === "production";

const sdkKey = process.env.ZOOM_SDK_KEY;
const sdkSecret = process.env.ZOOM_SDK_SECRET;
const port = process.env.PORT ? Number(process.env.PORT) : 3000;
const endpointUrl = process.env.RENDER_EXTERNAL_URL || process.env.ENDPOINT_URL || null;

const app = express();
app.use(cors());
// models/ lives outside dist, so serve it explicitly for the browser/worker fetches.
app.use("/models", express.static(path.join(__dirname, "models")));

let vite: import("vite").ViteDevServer | undefined;

function generateSignature(
	sessionName: string,
	role: number,
	expiresInHours: number = 2,
): string {
	const iat = Math.round(new Date().getTime() / 1000) - 30;
	const exp = iat + 60 * 60 * expiresInHours;
	const oHeader = { alg: "HS256", typ: "JWT" };
	const oPayload = {
		app_key: sdkKey,
		tpc: sessionName,
		role_type: role,
		version: 1,
		iat: iat,
		exp: exp,
	};
	const sHeader = JSON.stringify(oHeader);
	const sPayload = JSON.stringify(oPayload);
	return KJUR.KJUR.jws.JWS.sign("HS256", sHeader, sPayload, sdkSecret!);
}

// Zoom token generation endpoint
app.get("/zoomtoken", (req, res) => {
	if (!sdkKey || !sdkSecret) {
		res.status(500).json({
			error: "ZOOM_SDK_KEY and ZOOM_SDK_SECRET must be set in your environment or .env file",
		});
		return;
	}

	const sessionName =
		typeof req.query.session === "string" && req.query.session.trim() !== ""
			? req.query.session
			: "TestSession";
	const role = req.query.role ? parseInt(req.query.role as string, 10) : 1;
	const expiresInHours = req.query.expires
		? parseFloat(req.query.expires as string)
		: 2;

	if (!Number.isInteger(role) || role < 0) {
		res.status(400).json({ error: `Invalid role: ${req.query.role}` });
		return;
	}

	if (isNaN(expiresInHours) || expiresInHours <= 0) {
		res.status(400).json({ error: `Invalid expires: ${req.query.expires}` });
		return;
	}

	const token = generateSignature(sessionName, role, expiresInHours);
	res.json({ token });
});

// Server configuration endpoint
app.get("/config", (_req, res) => {
	res.json({ endpointUrl });
});

if (!isProduction) {
	const { createServer } = await import("vite");
	vite = await createServer({
		root: __dirname,
		server: { middlewareMode: true },
		appType: "custom",
	});
	app.use(vite.middlewares);
} else {
	app.use(express.static(distDir));
}

app.get(/^(?!\/zoomtoken|\/config).*/, async (req, res, next) => {
	try {
		if (vite) {
			// Dev: let Vite inject HMR client/import maps into the raw index.html.
			const raw = fs.readFileSync(path.join(__dirname, "index.html"), "utf-8");
			const html = await vite.transformIndexHtml(req.originalUrl, raw);
			res.status(200).set({ "Content-Type": "text/html" }).end(html);
		} else {
			res.sendFile(path.join(distDir, "index.html"));
		}
	} catch (err) {
		vite?.ssrFixStacktrace(err as Error);
		next(err);
	}
});

app.listen(port, () => {
	console.log(`Zoom token server listening on port ${port}`);
});
