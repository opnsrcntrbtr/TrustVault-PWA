# WebLLM Engine Initialization Fails on Qualcomm Adreno GPUs with VK_ERROR_DEVICE_LOST

## Summary
WebLLM engine initialization reliably crashes with `VK_ERROR_DEVICE_LOST` during the first Vulkan queue submission on Qualcomm Adreno GPUs running Android. The issue is reproducible across two different Adreno generations and persists regardless of model precision, size, or context window tuning. Plain WebGPU compute operations work correctly on the same devices, isolating the failure to WebLLM's shader compilation and kernel execution path.

---

## Environment Details

### Device 1: Low-End / Older Adreno
- **Device Model**: I2019
- **Android Version**: 10
- **GPU**: Qualcomm Adreno 6xx
- **RAM**: 4–6 GB
- **Chrome**: Stable (version ~120+)
- **Result**: `Device was lost` error during WebLLM warm-up

### Device 2: Mid-Range / Newer Adreno
- **Device Model**: A059 (Snapdragon 7s Gen 3)
- **Android Version**: 16
- **GPU**: Qualcomm Adreno 810 (SM7635)
- **RAM**: ~8 GB
- **Chrome**: Stable (version ~149+)
- **Result**: `vkQueueSubmit failed with VK_ERROR_DEVICE_LOST` error during WebLLM warm-up

### WebLLM Details
- **Version**: `@mlc-ai/web-llm@0.2.84` (latest at time of testing)
- **Backend**: Vulkan via Dawn (Chrome's WebGPU implementation)
- **GPU Feature Support**: Both devices report `shader-f16` feature available

---

## Problem Description

WebLLM engine initialization (`CreateMLCEngine`) consistently fails during the warm-up phase on Adreno GPUs. The failure occurs **before any inference tokens are generated**, specifically during:
1. Shader compilation
2. GPU device/queue setup
3. First compute kernel dispatch

The GPU device is lost (invalidated by the Vulkan driver), leaving the WebGPU context in an unusable state.

---

## Reproduction Steps

### Setup
1. Android device with Qualcomm Adreno GPU (tested: Adreno 6xx, Adreno 810)
2. Chrome (stable channel, v120+)
3. WebLLM library (`@mlc-ai/web-llm@0.2.84`)
4. Any WebLLM model (tested: `Qwen2.5-0.5B-Instruct-q4f16_1-MLC`, `Llama-3.2-1B-Instruct-q4f16_1-MLC`, both q4f16 and q4f32)

### Steps
1. Verify WebGPU is available: `navigator.gpu.requestAdapter()` returns non-null
2. Call `CreateMLCEngine(modelId)` with any model ID from the WebLLM catalog
3. Observe failure during engine initialization (before `ensureReady()` completes)

### Expected Behavior
- Engine initializes successfully
- Inference runs locally without network egress
- Model weights are downloaded once and cached

### Actual Behavior
- Engine initialization throws error
- GPU device is lost
- No recovery without full page reload

---

## Error Messages & Debug Logs

### Device 1 (Adreno 6xx / Android 10)
```
password-generator:1 A valid external Instance reference no longer exists.
webllm-vendor-BLcHHCT2.js:1 Device was lost. This can happen due to insufficient memory 
or other GPU constraints. Detailed error: [object GPUDeviceLostInfo]. 
Please try to reload WebLLM with a less resource-intensive model.
```

Full stack trace shows failure in `reloadInternal()` during engine setup.

### Device 2 (Adreno 810 / Android 16)
```
password-generator:1 vkQueueSubmit failed with VK_ERROR_DEVICE_LOST
    at CheckVkSuccessImpl (../../third_party/dawn/src/dawn/native/vulkan/VulkanError.cpp:104)

webllm-vendor-BLcHHCT2.js:1 Device was lost. This can happen due to insufficient memory 
or other GPU constraints. Detailed error: [object GPUDeviceLostInfo]. 
Please try to reload WebLLM with a less resource-intensive model.
```

The Vulkan layer explicitly reports `VK_ERROR_DEVICE_LOST` at queue submission, indicating the driver is terminating the GPU context.

---

## Variables Tested & Ruled Out

| Variable | Values Tested | Result |
|---|---|---|
| **Model Precision** | q4f16, q4f32 | ❌ Both fail |
| **Model Size** | 0.5B, 1B | ❌ Both fail |
| **Context Window** | default, capped at 2048 | ❌ Both fail |
| **WebLLM Version** | 0.2.84 (latest) | ❌ Fails |
| **Android Version** | 10, 16 | ❌ Both fail |
| **Adreno Generation** | 6xx, 810 | ❌ Both fail |

**Proof of WebGPU health**: A standalone WebGPU f32 compute job (no WebLLM) runs successfully on the same devices, multiplying a 256-element array and reading back `[0, 2, 4, 6, 8]` without device-loss.

---

## Root Cause Analysis

1. **WebGPU compute works** → the GPU, WebGPU adapter, and compute capability are functional
2. **WebLLM fails at warm-up** → WebLLM's specific kernel compilation / dispatch triggers the issue
3. **Adreno-specific** → occurs on two different Adreno generations but no working Android GPU known
4. **No app-level lever** → precision, size, context, and library version do not help

**Hypothesis**: WebLLM's shader compilation or heavy fused kernel dispatch on Adreno exceeds GPU memory budgets or triggers driver bugs in the Qualcomm Vulkan stack, even though advertised limits (`maxBufferSize`, `maxStorageBufferBindingSize`) appear healthy.

---

## Impact

- **Qualcomm Adreno** is the dominant GPU on Android (used in most Snapdragon-based devices)
- **WebLLM cannot run on Adreno** at all — model download succeeds, but inference initialization always fails
- **No known working Android GPU** for WebLLM as of this testing
- Users attempting to use WebLLM on Android encounter silent failures or confusing error messages

---

## Proposed Workarounds / Gating

Until fixed upstream:
1. **Detect Adreno**: Use `adapter.info.vendor` (Qualcomm) or `adapter.info.architecture` to identify Adreno GPUs
2. **Disable WebLLM on Adreno**: Gate the feature so users are not prompted to download un-runable models
3. **Graceful error handling**: Catch `GPUDeviceLost` errors and surface a clear message ("On-device AI is not supported on your GPU")

---

## Requested Actions

- [ ] Confirm this is a known issue or investigate the Adreno Vulkan driver compatibility
- [ ] Provide guidance on whether this is fixable in WebLLM or requires upstream Qualcomm driver changes
- [ ] If fixable, prioritize Adreno support (largest Android GPU installed base)
- [ ] If not fixable, document the limitation so applications can gate the feature appropriately

---

## Additional Context

- **Repository**: [TrustVault PWA](https://github.com/ipgthb/trustvault-pwa)
- **Feature**: On-device AI inference via WebLLM on Android
- **Action Taken**: WebLLM Android surface gated off via `isMobileAiSurfaceEnabled = false` until this issue is resolved
- **Test Date**: 2026-06-21
- **WebLLM Version Tested**: 0.2.84

---

## Minimal Reproduction (Web-based)

```javascript
// Assumes navigator.gpu is available
const adapter = await navigator.gpu.requestAdapter();
const device = await adapter.requestDevice();

const modelId = 'Llama-3.2-1B-Instruct-q4f16_1-MLC'; // Any WebLLM model

try {
  const { CreateMLCEngine } = await import('@mlc-ai/web-llm');
  const engine = await CreateMLCEngine(modelId, {
    initProgressCallback: (r) => console.log(`Progress: ${r.progress}`),
  });
  console.log('Engine ready');
} catch (err) {
  console.error('Engine initialization failed:', err);
  // On Adreno, err will be: "Device was lost" or related GPU errors
}
```

**Expected**: Engine initializes successfully.
**Actual (Adreno)**: Throws "Device was lost" error.
