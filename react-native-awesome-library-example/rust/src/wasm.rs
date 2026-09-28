use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn rnrs_multiply(a_json: &str, b_json: &str) -> Result<String, JsValue> {
    let a: f64 = serde_json::from_str(a_json).map_err(|error| JsValue::from_str(&error.to_string()))?;
    let b: f64 = serde_json::from_str(b_json).map_err(|error| JsValue::from_str(&error.to_string()))?;
    let value = crate::api::multiply::multiply(a, b);
    serde_json::to_string(&value).map_err(|error| JsValue::from_str(&error.to_string()))
}

#[wasm_bindgen]
pub fn rnrs_subtract(a_json: &str, b_json: &str) -> Result<String, JsValue> {
    let a: f64 = serde_json::from_str(a_json).map_err(|error| JsValue::from_str(&error.to_string()))?;
    let b: f64 = serde_json::from_str(b_json).map_err(|error| JsValue::from_str(&error.to_string()))?;
    let value = crate::api::subtract::subtract(a, b);
    serde_json::to_string(&value).map_err(|error| JsValue::from_str(&error.to_string()))
}

#[wasm_bindgen]
pub fn rnrs_is_positive(value_json: &str) -> Result<String, JsValue> {
    let value: f64 = serde_json::from_str(value_json).map_err(|error| JsValue::from_str(&error.to_string()))?;
    let value = crate::api::is_positive::is_positive(value);
    serde_json::to_string(&value).map_err(|error| JsValue::from_str(&error.to_string()))
}

#[wasm_bindgen]
pub fn rnrs_greet(name_json: &str) -> Result<String, JsValue> {
    let name: String = serde_json::from_str(name_json).map_err(|error| JsValue::from_str(&error.to_string()))?;
    let value = crate::api::greet::greet(name);
    serde_json::to_string(&value).map_err(|error| JsValue::from_str(&error.to_string()))
}

#[wasm_bindgen]
pub fn rnrs_scale_values(values_json: &str) -> Result<String, JsValue> {
    let values: serde_json::Value = serde_json::from_str(values_json).map_err(|error| JsValue::from_str(&error.to_string()))?;
    let value = crate::api::scale_values::scale_values(values);
    serde_json::to_string(&value).map_err(|error| JsValue::from_str(&error.to_string()))
}

#[wasm_bindgen]
pub fn rnrs_annotate_object(value_json: &str) -> Result<String, JsValue> {
    let value: serde_json::Value = serde_json::from_str(value_json).map_err(|error| JsValue::from_str(&error.to_string()))?;
    let value = crate::api::annotate_object::annotate_object(value);
    serde_json::to_string(&value).map_err(|error| JsValue::from_str(&error.to_string()))
}

#[wasm_bindgen]
pub fn rnrs_calculate_async(value_json: &str) -> Result<String, JsValue> {
    let value: f64 = serde_json::from_str(value_json).map_err(|error| JsValue::from_str(&error.to_string()))?;
    let result = crate::api::calculate_async::calculate_async(value);
    result
        .map_err(|error| JsValue::from_str(&error))
        .and_then(|value| serde_json::to_string(&value).map_err(|error| JsValue::from_str(&error.to_string())))
}

#[wasm_bindgen]
pub fn rnrs_inspect_with_callback(value_json: &str, callback: &js_sys::Function) -> Result<(), JsValue> {
    let value: serde_json::Value = serde_json::from_str(value_json).map_err(|error| JsValue::from_str(&error.to_string()))?;
    let mut callback_callback = |label: String, score: f64, active: bool, details: serde_json::Value| {
        let payload = serde_json::to_string(&(label, score, active, details)).unwrap_or_default();
        let _ = callback.call1(&JsValue::NULL, &JsValue::from_str(&payload));
    };
    crate::api::inspect_with_callback::inspect_with_callback(value, &mut callback_callback);
    Ok(())
}
