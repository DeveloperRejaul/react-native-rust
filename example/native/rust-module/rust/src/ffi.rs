use serde::de::DeserializeOwned;
use serde::Serialize;
use std::ffi::c_void;
use std::panic::{catch_unwind, AssertUnwindSafe};
use std::slice;

#[repr(C)]
#[derive(Clone, Copy)]
pub struct RustSlice {
    pub data: *const u8,
    pub len: usize,
}

#[repr(C)]
pub struct RustBuffer {
    pub data: *mut u8,
    pub len: usize,
    pub capacity: usize,
    pub is_error: bool,
}

#[repr(C)]
#[derive(Clone, Copy)]
pub struct RustCallback {
    pub context: *mut c_void,
    pub invoke: unsafe extern "C" fn(*mut c_void, RustSlice),
}

pub unsafe fn decode_json<T: DeserializeOwned>(value: RustSlice) -> Result<T, String> {
    let bytes = if value.len == 0 {
        &[]
    } else {
        if value.data.is_null() {
            return Err("Received a null JSON buffer".to_string());
        }
        slice::from_raw_parts(value.data, value.len)
    };
    serde_json::from_slice(bytes).map_err(|error| format!("Invalid JSON input: {error}"))
}

fn into_buffer(mut bytes: Vec<u8>, is_error: bool) -> RustBuffer {
    let buffer = RustBuffer {
        data: bytes.as_mut_ptr(),
        len: bytes.len(),
        capacity: bytes.capacity(),
        is_error,
    };
    std::mem::forget(bytes);
    buffer
}

pub fn encode_result<T: Serialize>(result: Result<T, String>) -> RustBuffer {
    match result {
        Ok(value) => match serde_json::to_vec(&value) {
            Ok(bytes) => into_buffer(bytes, false),
            Err(error) => into_buffer(error.to_string().into_bytes(), true),
        },
        Err(error) => into_buffer(error.into_bytes(), true),
    }
}

pub fn catch_json<T: Serialize>(call: impl FnOnce() -> Result<T, String>) -> RustBuffer {
    let result = catch_unwind(AssertUnwindSafe(call))
        .unwrap_or_else(|_| Err("Rust handler panicked".to_string()));
    encode_result(result)
}

#[no_mangle]
pub extern "C" fn rnrs_buffer_free(buffer: RustBuffer) {
    if !buffer.data.is_null() {
        unsafe {
            drop(Vec::from_raw_parts(buffer.data, buffer.len, buffer.capacity));
        }
    }
}
