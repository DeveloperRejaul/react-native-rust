pub fn annotate_object(value: serde_json::Value) -> serde_json::Value {
    let mut value = value;
    if let Some(object) = value.as_object_mut() {
        object.insert("source".to_string(), serde_json::json!("Rust"));
    }
    value
}
