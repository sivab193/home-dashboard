# Keep home data local

Commit reusable code, documentation, synthetic tests and placeholder examples.
Never commit credentials, private calendar URLs, pairing codes, device serials,
LAN addresses, house layouts, reference photos, recordings or browser profiles.

Normal local paths are ignored: `.env*` except `.env.example`,
`alerts/config.local.yaml`, local/default diorama models, `data/`, runtime logs,
Home Assistant databases and `.impeccable/` screenshots. Review staged changes;
renaming or force-adding a file can bypass ignore rules. Revoke credentials if
they ever enter Git; deleting a file does not remove its history.

Keep personal house backups private. Port reviewed source patches from a private
deployment; never merge its history into this public project. This edition starts
with fresh history and no personal configuration.

Weather queries go to Open-Meteo, stock symbols to Yahoo Finance through the
home service, and calendar requests to your configured feed. Home Assistant and
calendar credentials stay on the server. The app is for a trusted LAN and has
no user authentication for internet exposure.
