mod api;
mod ffi;
#[cfg(target_arch = "wasm32")]
mod wasm;
pub use ffi::{rnrs_buffer_free, RustBuffer, RustCallback, RustSlice};

#[cfg(not(target_arch = "wasm32"))]
#[no_mangle]
pub extern "C" fn rnrs_multiply(a: ffi::RustSlice, b: ffi::RustSlice) -> ffi::RustBuffer {
    ffi::catch_json(|| {
        let a: f64 = unsafe { ffi::decode_json(a) }?;
        let b: f64 = unsafe { ffi::decode_json(b) }?;
        Ok(api::multiply::multiply(a, b))
    })
}

#[cfg(not(target_arch = "wasm32"))]
#[no_mangle]
pub extern "C" fn rnrs_subtract(a: ffi::RustSlice, b: ffi::RustSlice) -> ffi::RustBuffer {
    ffi::catch_json(|| {
        let a: f64 = unsafe { ffi::decode_json(a) }?;
        let b: f64 = unsafe { ffi::decode_json(b) }?;
        Ok(api::subtract::subtract(a, b))
    })
}

#[cfg(not(target_arch = "wasm32"))]
#[no_mangle]
pub extern "C" fn rnrs_is_positive(value: ffi::RustSlice) -> ffi::RustBuffer {
    ffi::catch_json(|| {
        let value: f64 = unsafe { ffi::decode_json(value) }?;
        Ok(api::is_positive::is_positive(value))
    })
}

#[cfg(not(target_arch = "wasm32"))]
#[no_mangle]
pub extern "C" fn rnrs_greet(name: ffi::RustSlice) -> ffi::RustBuffer {
    ffi::catch_json(|| {
        let name: String = unsafe { ffi::decode_json(name) }?;
        Ok(api::greet::greet(name))
    })
}

#[cfg(not(target_arch = "wasm32"))]
#[no_mangle]
pub extern "C" fn rnrs_scale_values(values: ffi::RustSlice) -> ffi::RustBuffer {
    ffi::catch_json(|| {
        let values: serde_json::Value = unsafe { ffi::decode_json(values) }?;
        Ok(api::scale_values::scale_values(values))
    })
}

#[cfg(not(target_arch = "wasm32"))]
#[no_mangle]
pub extern "C" fn rnrs_annotate_object(value: ffi::RustSlice) -> ffi::RustBuffer {
    ffi::catch_json(|| {
        let value: serde_json::Value = unsafe { ffi::decode_json(value) }?;
        Ok(api::annotate_object::annotate_object(value))
    })
}

#[cfg(not(target_arch = "wasm32"))]
#[no_mangle]
pub extern "C" fn rnrs_calculate_async(value: ffi::RustSlice) -> ffi::RustBuffer {
    ffi::catch_json(|| {
        let value: f64 = unsafe { ffi::decode_json(value) }?;
        api::calculate_async::calculate_async(value)
    })
}

#[cfg(not(target_arch = "wasm32"))]
#[no_mangle]
pub extern "C" fn rnrs_inspect_with_callback(value: ffi::RustSlice, callback: ffi::RustCallback) -> ffi::RustBuffer {
    ffi::catch_json(|| {
        let value: serde_json::Value = unsafe { ffi::decode_json(value) }?;
        let mut callback_callback = |label: String, score: f64, active: bool, details: serde_json::Value| {
            let payload = serde_json::to_vec(&(label, score, active, details)).unwrap_or_default();
            let slice = ffi::RustSlice { data: payload.as_ptr(), len: payload.len() };
            unsafe { (callback.invoke)(callback.context, slice); }
        };
        api::inspect_with_callback::inspect_with_callback(value, &mut callback_callback);
        Ok(())
    })
}
