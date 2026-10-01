# V2.6 validation status

- Production `main`: untouched by this validation work.
- Isolated engine: implemented.
- Deterministic tests: implemented.
- GitHub Actions validation workflow: implemented.
- Real `mr_state` runner: implemented; intentionally requires local exported state so API keys/history are not committed.
- Production merge: blocked until deterministic CI passes and real-data rolling results are reviewed.
