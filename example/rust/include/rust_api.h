#include <cstdarg>
#include <cstdint>
#include <cstdlib>
#include <ostream>
#include <new>

struct RustBuffer {
  uint8_t *data;
  uintptr_t len;
  uintptr_t capacity;
  bool is_error;
};

struct RustSlice {
  const uint8_t *data;
  uintptr_t len;
};

struct RustCallback {
  void *context;
  void (*invoke)(void*, RustSlice);
};

extern "C" {

RustBuffer rnrs_multiply(RustSlice a, RustSlice b);

RustBuffer rnrs_is_positive(RustSlice value);

RustBuffer rnrs_greet(RustSlice name);

RustBuffer rnrs_scale_values(RustSlice values);

RustBuffer rnrs_annotate_object(RustSlice value);

RustBuffer rnrs_calculate_async(RustSlice value);

RustBuffer rnrs_inspect_with_callback(RustSlice value, RustCallback callback);

void rnrs_buffer_free(RustBuffer buffer);

} // extern "C"
