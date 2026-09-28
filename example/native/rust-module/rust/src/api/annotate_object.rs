pub fn annotate_object(value: serde_json::Value) -> serde_json::Value {
    let mut value = value;
    if let Some(object) = value.as_object_mut() {
        object.insert("source".to_string(), serde_json::json!("Rust"));
    }
    value
}

#[cfg(test)]
mod tests {
    use super::annotate_object;

    #[test]
    fn adds_rust_source_to_object() {
        assert_eq!(
            annotate_object(serde_json::json!({ "name": "Ada" })),
            serde_json::json!({ "name": "Ada", "source": "Rust" })
        );
    }
}
