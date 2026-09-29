pub fn inspect_with_callback(
    value: serde_json::Value,
    callback: &mut dyn FnMut(String, f64, bool, serde_json::Value),
) -> () {
    let label = value
        .get("name")
        .and_then(serde_json::Value::as_str)
        .unwrap_or("profile")
        .to_string();
    let score = value
        .get("score")
        .and_then(serde_json::Value::as_f64)
        .unwrap_or_default();
    let active = value
        .get("active")
        .and_then(serde_json::Value::as_bool)
        .unwrap_or(false);
    let field_count = value.as_object().map_or(0, serde_json::Map::len);
    callback(
        label,
        score,
        active,
        serde_json::json!({ "source": "Rust", "fieldCount": field_count }),
    );
}

#[cfg(test)]
mod tests {
    use super::inspect_with_callback;

    #[test]
    fn calls_with_supported_callback_values() {
        let mut received = None;
        inspect_with_callback(
            serde_json::json!({ "name": "Ada", "score": 92, "active": true }),
            &mut |label, score, active, details| {
                received = Some((label, score, active, details));
            },
        );
        let (label, score, active, details) = received.unwrap();
        assert_eq!(label, "Ada");
        assert_eq!(score, 92.0);
        assert!(active);
        assert_eq!(details, serde_json::json!({ "source": "Rust", "fieldCount": 3 }));
    }
}
