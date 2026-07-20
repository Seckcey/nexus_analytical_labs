from __future__ import annotations

from flask import Flask, Response


SCRIPT_TAG = '<script defer src="/static/js/analytics.js"></script>'


def install_analytics(app: Flask) -> None:
    """Inject the reviewed browser tracker into HTML pages only."""

    @app.after_request
    def inject_analytics(response: Response) -> Response:
        if response.mimetype != "text/html":
            return response

        body = response.get_data(as_text=True)
        if SCRIPT_TAG in body or "</body>" not in body:
            return response

        response.set_data(body.replace("</body>", f"  {SCRIPT_TAG}\n</body>", 1))
        response.headers.pop("Content-Length", None)
        return response
