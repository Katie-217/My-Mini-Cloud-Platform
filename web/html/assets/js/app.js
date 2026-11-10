/**
 * MyMiniCloud - Student Management App JavaScript
 * Quản lý sinh viên, CRUD cơ sở dữ liệu SQL Server 2022, lưu trữ S3 MinIO
 */

(function () {
  'use strict';

  // State quản lý ứng dụng
  const AppState = {
    students: [],
    majors: new Set(),
    activeTab: 'dashboard',
    selectedFile: null
  };

  // =========================================================================
  // Tiện ích: Escape HTML (chống XSS) & Định dạng số / ngày
  // =========================================================================
  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function formatFileSize(bytes) {
    if (bytes === 0 || !bytes) return '0.00 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return (bytes / Math.pow(k, i)).toFixed(2) + ' ' + sizes[i];
  }

  function formatDate(isoStr) {
    if (!isoStr) return '--';
    const value = isoStr.includes('T') && !/(Z|[+-]\d\d:\d\d)$/.test(isoStr) ? isoStr + 'Z' : isoStr;
    const d = new Date(value);
    if (isNaN(d.getTime())) return escapeHtml(isoStr);
    return d.toLocaleDateString('vi-VN');
  }

  function formatDateTime(isoStr) {
    if (!isoStr) return '--';
    const value = isoStr.includes('T') && !/(Z|[+-]\d\d:\d\d)$/.test(isoStr) ? isoStr + 'Z' : isoStr;
    const d = new Date(value);
    if (isNaN(d.getTime())) return escapeHtml(isoStr);
    return d.toLocaleTimeString('vi-VN') + ' ' + d.toLocaleDateString('vi-VN');
  }

  function formatGpa(gpa) {
    const val = parseFloat(gpa);
    if (isNaN(val)) return '0.00';
    return val.toFixed(2);
  }

  function getGpaBadgeClass(gpa) {
    const val = parseFloat(gpa);
    if (isNaN(val)) return 'gpa-med';
    if (val >= 3.6) return 'gpa-high';
    if (val >= 3.2) return 'gpa-good';
    if (val >= 2.5) return 'gpa-med';
    return 'gpa-low';
  }

  // =========================================================================
  // Điều hướng Tabs
  // =========================================================================
  function switchTab(tabId) {
    AppState.activeTab = tabId;

    // Cập nhật nút tab pill
    document.querySelectorAll('.top-tab-btn[data-tab]').forEach(btn => {
      if (btn.getAttribute('data-tab') === tabId) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Cập nhật panel tab
    document.querySelectorAll('.tab-pane').forEach(pane => {
      if (pane.id === `tab-${tabId}`) {
        pane.classList.add('active');
      } else {
        pane.classList.remove('active');
      }
    });

    // Tự động tải dữ liệu
    if (tabId === 'students' || tabId === 'dashboard') {
      loadStudents();
    } else if (tabId === 'storage') {
      loadFilesList();
    }
  }

  // =========================================================================
  // 1. Quản lý Sinh viên (CRUD SQL Server 2022)
  // =========================================================================
  async function loadStudents(searchQuery = '') {
    const tableBody = document.getElementById('students-table-body');
    const loadingRow = document.getElementById('students-loading');
    const emptyRow = document.getElementById('students-empty');

    if (loadingRow) loadingRow.style.display = 'table-row';
    if (emptyRow) emptyRow.style.display = 'none';

    try {
      let url = '/api/students-db';
      if (searchQuery.trim()) {
        url += `?q=${encodeURIComponent(searchQuery.trim())}`;
      }

      const res = await fetch(url, { headers: { 'Accept': 'application/json' }, cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const students = await res.json();
      AppState.students = Array.isArray(students) ? students : [];

      // Cập nhật thống kê Dashboard
      updateDashboardStats(AppState.students);

      // Render danh sách sinh viên
      renderStudentsTable(AppState.students);

    } catch (err) {
      console.warn('Lỗi tải sinh viên:', err);
      if (tableBody) {
        tableBody.innerHTML = `
          <tr>
            <td colspan="8" style="text-align: center; padding: 2rem; color: #dc2626;">
              Không thể kết nối đến máy chủ cơ sở dữ liệu: ${escapeHtml(err.message)}
            </td>
          </tr>
        `;
      }
    }
  }

  function updateDashboardStats(students) {
    const totalEl = document.getElementById('stat-total-students');
    const activeEl = document.getElementById('stat-active-students');
    const activePercentEl = document.getElementById('stat-active-percent');
    const inactiveEl = document.getElementById('stat-inactive-students');
    const majorsEl = document.getElementById('stat-total-majors');

    const total = students.length;
    let active = 0;
    let inactive = 0;
    const majors = new Set();

    students.forEach(s => {
      const gpa = parseFloat(s.gpa) || 0;
      if (gpa >= 2.5) {
        active++;
      } else {
        inactive++;
      }
      if (s.major) majors.add(s.major.trim());
    });

    if (totalEl) totalEl.textContent = total;
    if (activeEl) activeEl.textContent = active;
    if (inactiveEl) inactiveEl.textContent = inactive;

    if (activePercentEl) {
      const pct = total > 0 ? ((active / total) * 100).toFixed(2) : '0.00';
      activePercentEl.textContent = `${pct}% of total`;
    }

    if (majorsEl) majorsEl.textContent = majors.size || 5;
  }

  function renderStudentsTable(students) {
    const tableBody = document.getElementById('students-table-body');
    if (!tableBody) return;

    if (!students || students.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align: center; padding: 2.5rem; color: #64748b;">
            Không tìm thấy sinh viên nào.
          </td>
        </tr>
      `;
      return;
    }

    tableBody.innerHTML = '';

    students.forEach(s => {
      const tr = document.createElement('tr');
      const gpaFormatted = formatGpa(s.gpa);
      const gpaClass = getGpaBadgeClass(s.gpa);

      let avatarHtml = `<div class="avatar-thumbnail">${escapeHtml((s.fullname || 'S').charAt(0).toUpperCase())}</div>`;
      if (s.avatar_key) {
        avatarHtml = `
          <img src="/api/files/profile-pics/${encodeURIComponent(s.avatar_key)}" 
               alt="${escapeHtml(s.fullname)}" 
               class="avatar-thumbnail"
               onerror="this.onerror=null; this.src=''; this.outerHTML='<div class=\\'avatar-thumbnail\\'>${escapeHtml((s.fullname || 'S').charAt(0).toUpperCase())}</div>';">
        `;
      }

      tr.innerHTML = `
        <td>${avatarHtml}</td>
        <td><code>#${escapeHtml(s.id)}</code></td>
        <td><strong>${escapeHtml(s.student_id)}</strong></td>
        <td>${escapeHtml(s.fullname)}</td>
        <td>${formatDate(s.dob)}</td>
        <td><span class="badge" style="background:#eff6ff; color:#1d4ed8;">${escapeHtml(s.major)}</span></td>
        <td><span class="gpa-badge ${gpaClass}">${gpaFormatted}</span></td>
        <td style="text-align: right; white-space: nowrap;">
          <button type="button" class="btn btn-secondary btn-sm" data-action="detail" data-id="${escapeHtml(s.id)}" title="Xem chi tiết">
            Chi tiết
          </button>
          <button type="button" class="btn btn-secondary btn-sm" data-action="edit" data-id="${escapeHtml(s.id)}" title="Chỉnh sửa">
            Sửa
          </button>
          <button type="button" class="btn btn-danger btn-sm" data-action="delete" data-id="${escapeHtml(s.id)}" data-name="${escapeHtml(s.fullname)}" data-code="${escapeHtml(s.student_id)}" title="Xóa">
            Xóa
          </button>
        </td>
      `;

      tableBody.appendChild(tr);
    });

    // Gắn sự kiện nút thao tác
    tableBody.querySelectorAll('[data-action="detail"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        openStudentDetailModal(id);
      });
    });

    tableBody.querySelectorAll('[data-action="edit"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        openStudentEditModal(id);
      });
    });

    tableBody.querySelectorAll('[data-action="delete"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const name = btn.getAttribute('data-name');
        const code = btn.getAttribute('data-code');
        openStudentDeleteModal(id, name, code);
      });
    });
  }

  // Modal Chi Tiết
  function openStudentDetailModal(id) {
    const s = AppState.students.find(item => String(item.id) === String(id));
    if (!s) return;

    const modal = document.getElementById('modal-student-detail');
    const content = document.getElementById('modal-detail-content');
    if (!modal || !content) return;

    let avatarImg = '';
    if (s.avatar_key) {
      avatarImg = `<img src="/api/files/profile-pics/${encodeURIComponent(s.avatar_key)}" alt="Avatar" style="width: 80px; height: 80px; border-radius: 50%; object-fit: cover; border: 2px solid #2563eb; margin-bottom: 1rem;">`;
    }

    content.innerHTML = `
      <div style="text-align: center; margin-bottom: 1.5rem;">
        ${avatarImg}
        <h4 style="font-size: 1.25rem; font-weight: 700; color: #0f172a; margin-bottom: 0.25rem;">${escapeHtml(s.fullname)}</h4>
        <p style="color: #64748b; font-size: 0.9rem;">Mã SV: <strong>${escapeHtml(s.student_id)}</strong></p>
      </div>

      <table class="data-table" style="margin-bottom: 0;">
        <tbody>
          <tr><th>ID Hệ Thống:</th><td><code>#${escapeHtml(s.id)}</code></td></tr>
          <tr><th>Ngày Sinh:</th><td>${formatDate(s.dob)}</td></tr>
          <tr><th>Chuyên Ngành:</th><td>${escapeHtml(s.major)}</td></tr>
          <tr><th>Điểm GPA:</th><td><span class="gpa-badge ${getGpaBadgeClass(s.gpa)}">${formatGpa(s.gpa)}</span> / 4.00</td></tr>
          <tr><th>Ảnh Thẻ (S3 Key):</th><td><code>${escapeHtml(s.avatar_key || 'Chưa cập nhật')}</code></td></tr>
          <tr><th>Thời Điểm Tạo:</th><td>${formatDateTime(s.created_at)}</td></tr>
        </tbody>
      </table>
    `;

    modal.classList.add('show');
    modal.setAttribute('aria-hidden', 'false');
  }

  // Modal Sửa
  function openStudentEditModal(id) {
    const s = AppState.students.find(item => String(item.id) === String(id));
    if (!s) return;

    const modal = document.getElementById('modal-student-edit');
    if (!modal) return;

    document.getElementById('edit-id').value = s.id;
    document.getElementById('edit-student-id').value = s.student_id;
    document.getElementById('edit-fullname').value = s.fullname;
    document.getElementById('edit-dob').value = s.dob ? s.dob.slice(0, 10) : '';
    document.getElementById('edit-major').value = s.major;
    document.getElementById('edit-gpa').value = formatGpa(s.gpa);

    const preview = document.getElementById('edit-avatar-preview');
    if (preview) {
      if (s.avatar_key) {
        preview.src = `/api/files/profile-pics/${encodeURIComponent(s.avatar_key)}`;
        preview.style.display = 'block';
      } else {
        preview.style.display = 'none';
      }
    }

    const alertBox = document.getElementById('edit-student-alert');
    if (alertBox) alertBox.style.display = 'none';

    modal.classList.add('show');
    modal.setAttribute('aria-hidden', 'false');
  }

  // Modal Xóa
  let studentIdToDelete = null;
  function openStudentDeleteModal(id, name, code) {
    studentIdToDelete = id;
    const modal = document.getElementById('modal-student-delete');
    if (!modal) return;

    const nameEl = document.getElementById('delete-student-name');
    const codeEl = document.getElementById('delete-student-code');
    if (nameEl) nameEl.textContent = name;
    if (codeEl) codeEl.textContent = code;

    modal.classList.add('show');
    modal.setAttribute('aria-hidden', 'false');
  }

  function closeModals() {
    document.querySelectorAll('.modal-backdrop').forEach(m => {
      m.classList.remove('show');
      m.setAttribute('aria-hidden', 'true');
    });
  }

  // =========================================================================
  // 2. Thêm Sinh Viên (Add Student Form)
  // =========================================================================
  async function handleAddStudentSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const alertBox = document.getElementById('add-student-alert');

    const student_id = form.student_id.value.trim();
    const fullname = form.fullname.value.trim();
    const dob = form.dob.value;
    const major = form.major.value;
    const gpa = parseFloat(form.gpa.value);
    const avatarInput = document.getElementById('add-avatar-file');

    if (!student_id || !fullname || !dob || !major || isNaN(gpa)) {
      if (alertBox) {
        alertBox.className = 'alert alert-danger';
        alertBox.textContent = 'Vui lòng điền đầy đủ các trường bắt buộc.';
        alertBox.style.display = 'block';
      }
      return;
    }

    try {
      let avatar_key = null;

      // 1. Nếu có chọn ảnh thẻ, upload lên S3 MinIO trước
      if (avatarInput && avatarInput.files && avatarInput.files[0]) {
        const file = avatarInput.files[0];
        const formData = new FormData();
        formData.append('file', file);
        formData.append('bucket', 'profile-pics');

        const fileRes = await fetch('/api/files', {
          method: 'POST',
          body: formData
        });

        if (fileRes.ok) {
          const fileData = await fileRes.json();
          avatar_key = fileData.key;
        }
      }

      // 2. Lưu thông tin sinh viên vào database SQL Server
      const payload = {
        student_id,
        fullname,
        dob,
        major,
        gpa: parseFloat(gpa.toFixed(2)),
        avatar_key
      };

      const res = await fetch('/api/students-db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `HTTP ${res.status}`);
      }

      // Thành công: Reset form, chuyển về tab danh sách sinh viên
      form.reset();
      const preview = document.getElementById('add-avatar-preview');
      if (preview) preview.style.display = 'none';

      switchTab('students');
      loadStudents();

    } catch (err) {
      if (alertBox) {
        alertBox.className = 'alert alert-danger';
        alertBox.textContent = `Lỗi thêm sinh viên: ${err.message}`;
        alertBox.style.display = 'block';
      }
    }
  }

  // =========================================================================
  // 3. File Storage (Kéo thả tệp & Danh sách tài liệu)
  // =========================================================================
  async function loadFilesList() {
    const tbody = document.getElementById('files-table-body');
    const loading = document.getElementById('files-loading');
    const empty = document.getElementById('files-empty');

    if (loading) loading.style.display = 'table-row';
    if (empty) empty.style.display = 'none';

    try {
      const res = await fetch('/api/files?bucket=documents', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const files = await res.json();

      if (!tbody) return;
      tbody.innerHTML = '';

      if (!Array.isArray(files) || files.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="4" style="text-align: center; padding: 2.5rem; color: #64748b;">
              Chưa có tài liệu PDF nào được lưu trữ.
            </td>
          </tr>
        `;
        return;
      }

      files.forEach(f => {
        const tr = document.createElement('tr');
        const sizeFormatted = formatFileSize(f.size);
        const timeFormatted = formatDateTime(f.last_modified);
        const downloadUrl = `/api/files/documents/${encodeURIComponent(f.name)}`;

        tr.innerHTML = `
          <td>
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
              </svg>
              <strong style="color: #0f172a;">${escapeHtml(f.name)}</strong>
            </div>
          </td>
          <td><code>${sizeFormatted}</code></td>
          <td>${timeFormatted}</td>
          <td style="text-align: right;">
            <a href="${escapeHtml(downloadUrl)}" target="_blank" rel="noopener" class="btn btn-secondary btn-sm">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
              Tải về
            </a>
          </td>
        `;
        tbody.appendChild(tr);
      });

    } catch (err) {
      if (tbody) {
        tbody.innerHTML = `
          <tr>
            <td colspan="4" style="text-align: center; padding: 2rem; color: #dc2626;">
              Không thể tải danh sách tệp: ${escapeHtml(err.message)}
            </td>
          </tr>
        `;
      }
    }
  }

  function handleFileSelected(file) {
    if (!file) return;

    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      alert('Vui lòng chọn tệp định dạng PDF.');
      return;
    }

    AppState.selectedFile = file;

    const display = document.getElementById('selected-file-display');
    const nameEl = document.getElementById('selected-file-name');
    const sizeEl = document.getElementById('selected-file-size');
    const submitBtn = document.getElementById('btn-submit-upload');

    if (nameEl) nameEl.textContent = file.name;
    if (sizeEl) sizeEl.textContent = `(${formatFileSize(file.size)})`;
    if (display) display.style.display = 'block';
    if (submitBtn) submitBtn.disabled = false;
  }

  async function handleFileUploadSubmit(e) {
    e.preventDefault();
    if (!AppState.selectedFile) return;

    const alertBox = document.getElementById('upload-file-alert');
    const submitBtn = document.getElementById('btn-submit-upload');

    if (submitBtn) submitBtn.disabled = true;

    try {
      const formData = new FormData();
      formData.append('file', AppState.selectedFile);
      formData.append('bucket', 'documents');

      const res = await fetch('/api/files', {
        method: 'POST',
        body: formData
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `HTTP ${res.status}`);
      }

      // Upload thành công
      AppState.selectedFile = null;
      const fileInput = document.getElementById('doc-file-input');
      if (fileInput) fileInput.value = '';

      const display = document.getElementById('selected-file-display');
      if (display) display.style.display = 'none';

      if (alertBox) {
        alertBox.className = 'alert alert-healthy';
        alertBox.textContent = 'Đã tải lên tài liệu thành công!';
        alertBox.style.display = 'block';
        setTimeout(() => { alertBox.style.display = 'none'; }, 3000);
      }

      loadFilesList();

    } catch (err) {
      if (alertBox) {
        alertBox.className = 'alert alert-danger';
        alertBox.textContent = `Lỗi tải tệp: ${err.message}`;
        alertBox.style.display = 'block';
      }
    } finally {
      if (submitBtn) submitBtn.disabled = !AppState.selectedFile;
    }
  }

  // =========================================================================
  // Khởi tạo sự kiện DOM
  // =========================================================================
  document.addEventListener('DOMContentLoaded', () => {
    // 1. Tab Navigation
    document.querySelectorAll('.top-tab-btn[data-tab], .quick-action-card[data-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-tab');
        switchTab(tab);
      });
    });

    // 2. Chuyển tab Thêm Sinh Viên từ nút trong trang Students
    const gotoAddBtn = document.getElementById('btn-goto-add-student');
    if (gotoAddBtn) {
      gotoAddBtn.addEventListener('click', () => switchTab('add-student'));
    }

    const backBtn = document.getElementById('btn-back-to-students');
    if (backBtn) {
      backBtn.addEventListener('click', () => switchTab('students'));
    }

    const cancelAddBtn = document.getElementById('btn-cancel-add-student');
    if (cancelAddBtn) {
      cancelAddBtn.addEventListener('click', () => switchTab('students'));
    }

    // 3. Search sinh viên với debounce
    const searchInput = document.getElementById('search-student-input');
    let searchTimeout = null;
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
          loadStudents(searchInput.value);
        }, 300);
      });
    }

    const refreshStudentsBtn = document.getElementById('btn-refresh-students');
    if (refreshStudentsBtn) {
      refreshStudentsBtn.addEventListener('click', () => {
        if (searchInput) searchInput.value = '';
        loadStudents();
      });
    }

    // 4. Form thêm sinh viên
    const addForm = document.getElementById('add-student-form');
    if (addForm) {
      addForm.addEventListener('submit', handleAddStudentSubmit);
    }

    const avatarFileInput = document.getElementById('add-avatar-file');
    if (avatarFileInput) {
      avatarFileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        const preview = document.getElementById('add-avatar-preview');
        if (file && preview) {
          const reader = new FileReader();
          reader.onload = (ev) => {
            preview.src = ev.target.result;
            preview.style.display = 'block';
          };
          reader.readAsDataURL(file);
        }
      });
    }

    // 5. Form sửa sinh viên
    const editForm = document.getElementById('edit-student-form');
    if (editForm) {
      editForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('edit-id').value;
        const fullname = document.getElementById('edit-fullname').value.trim();
        const dob = document.getElementById('edit-dob').value;
        const major = document.getElementById('edit-major').value;
        const gpa = parseFloat(document.getElementById('edit-gpa').value);
        const avatarInput = document.getElementById('edit-avatar-file');
        const alertBox = document.getElementById('edit-student-alert');

        try {
          let avatar_key = undefined;
          if (avatarInput && avatarInput.files && avatarInput.files[0]) {
            const formData = new FormData();
            formData.append('file', avatarInput.files[0]);
            formData.append('bucket', 'profile-pics');
            const fileRes = await fetch('/api/files', { method: 'POST', body: formData });
            if (fileRes.ok) {
              const fileData = await fileRes.json();
              avatar_key = fileData.key;
            }
          }

          const payload = { fullname, dob, major, gpa: parseFloat(gpa.toFixed(2)) };
          if (avatar_key !== undefined) payload.avatar_key = avatar_key;

          const res = await fetch(`/api/students-db/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });

          if (!res.ok) throw new Error(`HTTP ${res.status}`);

          closeModals();
          loadStudents();

        } catch (err) {
          if (alertBox) {
            alertBox.className = 'alert alert-danger';
            alertBox.textContent = `Lỗi cập nhật: ${err.message}`;
            alertBox.style.display = 'block';
          }
        }
      });
    }

    // 6. Xóa sinh viên
    const confirmDeleteBtn = document.getElementById('btn-confirm-delete');
    if (confirmDeleteBtn) {
      confirmDeleteBtn.addEventListener('click', async () => {
        if (!studentIdToDelete) return;
        try {
          const res = await fetch(`/api/students-db/${studentIdToDelete}`, { method: 'DELETE' });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          closeModals();
          loadStudents();
        } catch (err) {
          alert(`Lỗi khi xóa sinh viên: ${err.message}`);
        }
      });
    }

    // 7. Kéo thả tệp tài liệu PDF (Drag & Drop)
    const dropzone = document.getElementById('file-dropzone');
    const docFileInput = document.getElementById('doc-file-input');
    const uploadDocForm = document.getElementById('upload-document-form');
    const refreshFilesBtn = document.getElementById('btn-refresh-files');

    if (dropzone && docFileInput) {
      dropzone.addEventListener('click', () => {
        docFileInput.click();
      });

      docFileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
          handleFileSelected(e.target.files[0]);
        }
      });

      dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
      });

      dropzone.addEventListener('dragleave', () => {
        dropzone.classList.remove('dragover');
      });

      dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
        if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
          handleFileSelected(e.dataTransfer.files[0]);
        }
      });
    }

    if (uploadDocForm) {
      uploadDocForm.addEventListener('submit', handleFileUploadSubmit);
    }

    if (refreshFilesBtn) {
      refreshFilesBtn.addEventListener('click', loadFilesList);
    }

    // 8. Đóng modals
    document.querySelectorAll('[data-close-modal]').forEach(btn => {
      btn.addEventListener('click', closeModals);
    });

    document.querySelectorAll('.modal-backdrop').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModals();
      });
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeModals();
    });

    // 9. Khởi tạo tải sinh viên ban đầu
    loadStudents();
  });
})();
