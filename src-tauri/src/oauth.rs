use tauri::command;
use tiny_http::{Server, Response};

#[command]
pub async fn wait_for_oauth_callback(port: u16) -> Result<String, String> {
    let server = Server::http(format!("127.0.0.1:{}", port))
        .map_err(|e| format!("Failed to start OAuth listener: {}", e))?;

    // Wait for one request (with a timeout built into the loop)
    let request = server.recv().map_err(|e| format!("Failed to receive request: {}", e))?;

    let url = request.url().to_string();

    // Extract the authorization code from query params
    let code = url
        .split('?')
        .nth(1)
        .and_then(|query| {
            query.split('&').find_map(|param| {
                let mut parts = param.splitn(2, '=');
                match (parts.next(), parts.next()) {
                    (Some("code"), Some(value)) => Some(value.to_string()),
                    _ => None,
                }
            })
        })
        .ok_or_else(|| "No authorization code in callback".to_string())?;

    // Send a nice HTML response to the browser
    let html = r#"<html><body style="background:#0a0a0a;color:#00ff88;font-family:monospace;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
        <div style="text-align:center">
            <h1>AUTHENTICATION_COMPLETE</h1>
            <p>You can close this tab and return to FocusForge.</p>
        </div>
    </body></html>"#;

    let response = Response::from_string(html)
        .with_header(tiny_http::Header::from_bytes("Content-Type", "text/html").unwrap());
    request.respond(response).map_err(|e| format!("Failed to respond: {}", e))?;

    Ok(code)
}

#[command]
pub fn get_available_port() -> Result<u16, String> {
    let listener = std::net::TcpListener::bind("127.0.0.1:0")
        .map_err(|e| format!("Failed to find available port: {}", e))?;
    let port = listener.local_addr()
        .map_err(|e| format!("Failed to get local addr: {}", e))?
        .port();
    drop(listener);
    Ok(port)
}
