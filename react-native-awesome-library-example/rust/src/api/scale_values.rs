pub fn scale_values(values: serde_json::Value) -> serde_json::Value {
    let Some(values) = values.as_array() else {
        return serde_json::json!([]);
    };
    let scaled: Vec<f64> = values
        .iter()
        .filter_map(serde_json::Value::as_f64)
        .map(|value| value * 2.0)
        .collect();
    serde_json::json!(scaled)
}
