use windows::Win32::Foundation::{CloseHandle, GetLastError, ERROR_ALREADY_EXISTS, HANDLE};
use windows::Win32::System::Threading::CreateMutexW;

pub struct SingleInstanceGuard {
    handle: HANDLE,
}

impl SingleInstanceGuard {
    pub fn acquire(name: &str) -> Option<Self> {
        let wide_name: Vec<u16> = name.encode_utf16().chain(std::iter::once(0)).collect();
        unsafe {
            let handle = CreateMutexW(None, true, windows::core::PCWSTR(wide_name.as_ptr())).ok()?;
            if GetLastError() == ERROR_ALREADY_EXISTS {
                let _ = CloseHandle(handle);
                None
            } else {
                Some(Self { handle })
            }
        }
    }
}

impl Drop for SingleInstanceGuard {
    fn drop(&mut self) {
        unsafe {
            let _ = CloseHandle(self.handle);
        }
    }
}
