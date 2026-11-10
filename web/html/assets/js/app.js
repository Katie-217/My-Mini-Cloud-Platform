/**
 * MyMiniCloud - Student Management App JavaScript
 * Tích hợp REST API, SQL Server 2022, MinIO S3 & Keycloak OIDC PKCE
 */

(function () {
  'use strict';

  // State quản lý ứng dụng
  const AppState = {
    students: [],
    majors: new Set(),
    activeTab: 'overview',
    authConfig: null,
    accessToken: null,
    userInfo: null,
    isBackendConnected: false
  };

  // =========================================================================
  // Helper: Xử lý chuỗi và Escape an toàn (Chống XSS)
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
    if (bytes === 0 || !bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  function formatDate(isoStr) {
    if (!isoStr) return '--';
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return escapeHtml(isoStr);
    return d.toLocaleDateString('vi-VN');
  }

  function formatDateTime(isoStr) {
    if (!isoStr) return '--';
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return escapeHtml(isoStr);
    return d.toLocaleTimeString('vi-VN') + ' ' + d.toLocaleDateString('vi-VN');
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
  // Điều hướng Tabs trong Ứng dụng
  // =========================================================================
  function switchTab(tabId) {
    AppState.activeTab = tabId;

    // Cập nhật trạng thái sidebar
    document.querySelectorAll('.sidebar-item[data-tab]').forEach(btn => {
      if (btn.getAttribute('data-tab') === tabId) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Cập nhật tab pane
    document.querySelectorAll('.tab-pane').forEach(pane => {
      if (pane.id === `tab-${tabId}`) {
        pane.classList.add('active');
      } else {
        pane.classList.remove('active');
      }
    });

    // Cập nhật tiêu đề Topbar
    const topbarTitle = document.getElementById('app-topbar-title');
    const titles = {
      overview: 'Tổng quan hệ thống',
      students: 'Danh sách sinh viên (SQL Server)',
      'add-student': 'Thêm sinh viên mới',
      storage: 'Lưu trữ tệp (MinIO S3)',
      account: 'Đăng nhập & Xác thực (Keycloak OIDC)',
      apidoc: 'Tài liệu API & Thử nghiệm'
    };
    if (topbarTitle && titles[tabId]) {
      topbarTitle.textContent = titles[tabId];
    }

    // Đóng sidebar trên màn hình di động
    const sidebar = document.getElementById('app-sidebar');
    if (sidebar && window.innerWidth <= 900) {
      sidebar.classList.remove('open');
    }

    // Tự động tải dữ liệu tương ứng của tab
    if (tabId === 'students' || tabId === 'overview') {
      loadStudents();
    } else if (tabId === 'storage') {
      loadFilesList();
    } else if (tabId === 'account') {
      loadAuthConfig();
    }
  }

  // =========================================================================
  // Quản lý Sinh viên (CRUD với /api/students-db)
  // =========================================================================
  async function loadStudents(searchQuery = '') {
    const tableBody = document.getElementById('students-table-body');
    const loadingRow = document.getElementById('students-loading');
    const emptyRow = document.getElementById('students-empty');
    const connAlert = document.getElementById('backend-conn-alert');
    const statusPill = document.getElementById('topbar-status-pill');

    let url = '/api/students-db';
    if (searchQuery.trim()) {
      url += `?q=${encodeURIComponent(searchQuery.trim())}`;
    }

    if (loadingRow) loadingRow.style.display = 'table-row';
    if (emptyRow) emptyRow.style.display = 'none';

    try {
      const response = await fetch(url, {
        headers: { 'Accept': 'application/json' },
        cache: 'no-store'
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      AppState.students = Array.isArray(data) ? data : [];
      AppState.isBackendConnected = true;

      if (statusPill) {
        statusPill.className = 'badge badge-healthy';
        statusPill.textContent = 'API Connected';
      }
      if (connAlert) connAlert.style.display = 'none';

      renderStudentsTable(AppState.students);
      updateOverviewStats(AppState.students);

    } catch (err) {
      AppState.students = [];
      AppState.isBackendConnected = false;

      if (statusPill) {
        statusPill.className = 'badge badge-unhealthy';
        statusPill.textContent = 'Chưa kết nối API';
      }
      if (connAlert) {
        connAlert.style.display = 'block';
        connAlert.textContent = `Không thể kết nối đến ${url} (${err.message}). Vui lòng đảm bảo container backend (Flask) và SQL Server đã khởi chạy.`;
      }

      renderStudentsTable([]);
      updateOverviewStats([]);
    } finally {
      if (loadingRow) loadingRow.style.display = 'none';
    }
  }

  function renderStudentsTable(students) {
    const tableBody = document.getElementById('students-table-body');
    const emptyRow = document.getElementById('students-empty');
    if (!tableBody) return;

    // Xóa các dòng cũ ngoại trừ loading/empty
    const existingRows = tableBody.querySelectorAll('tr:not(#students-loading):not(#students-empty)');
    existingRows.forEach(r => r.remove());

    if (!students || students.length === 0) {
      if (emptyRow) emptyRow.style.display = 'table-row';
      return;
    }
    if (emptyRow) emptyRow.style.display = 'none';

    students.forEach(st => {
      const tr = document.createElement('tr');

      // Cột Avatar
      const tdAvatar = document.createElement('td');
      if (st.avatar_key) {
        const img = document.createElement('img');
        img.className = 'avatar-thumbnail';
        img.src = `/api/files/profile-pics/${encodeURIComponent(st.avatar_key)}`;
        img.alt = 'Avatar';
        img.onerror = function () {
          img.style.display = 'none';
          const placeholder = document.createElement('div');
          placeholder.className = 'avatar-thumbnail';
          placeholder.textContent = (st.fullname || 'S').charAt(0).toUpperCase();
          tdAvatar.appendChild(placeholder);
        };
        tdAvatar.appendChild(img);
      } else {
        const placeholder = document.createElement('div');
        placeholder.className = 'avatar-thumbnail';
        placeholder.textContent = (st.fullname || 'S').charAt(0).toUpperCase();
        tdAvatar.appendChild(placeholder);
      }
      tr.appendChild(tdAvatar);

      // Cột ID
      const tdId = document.createElement('td');
      tdId.textContent = st.id !== undefined ? String(st.id) : '--';
      tr.appendChild(tdId);

      // Cột Mã SV
      const tdCode = document.createElement('td');
      const codeBadge = document.createElement('code');
      codeBadge.className = 'inline-code';
      codeBadge.textContent = st.student_id || '--';
      tdCode.appendChild(codeBadge);
      tr.appendChild(tdCode);

      // Cột Họ tên
      const tdName = document.createElement('td');
      const strongName = document.createElement('strong');
      strongName.textContent = st.fullname || '--';
      tdName.appendChild(strongName);
      tr.appendChild(tdName);

      // Cột Ngày sinh
      const tdDob = document.createElement('td');
      tdDob.textContent = formatDate(st.dob);
      tr.appendChild(tdDob);

      // Cột Ngành
      const tdMajor = document.createElement('td');
      tdMajor.textContent = st.major || '--';
      tr.appendChild(tdMajor);

      // Cột GPA
      const tdGpa = document.createElement('td');
      const gpaBadge = document.createElement('span');
      const gpaVal = st.gpa !== undefined && st.gpa !== null ? parseFloat(st.gpa).toFixed(2) : '0.00';
      gpaBadge.className = `gpa-badge ${getGpaBadgeClass(gpaVal)}`;
      gpaBadge.textContent = gpaVal;
      tdGpa.appendChild(gpaBadge);
      tr.appendChild(tdGpa);

      // Cột Thao tác
      const tdActions = document.createElement('td');
      tdActions.style.whiteSpace = 'nowrap';

      const btnView = document.createElement('button');
      btnView.type = 'button';
      btnView.className = 'btn btn-secondary btn-sm';
      btnView.style.marginRight = '0.35rem';
      btnView.textContent = 'Xem';
      btnView.addEventListener('click', () => viewStudentDetail(st));
      tdActions.appendChild(btnView);

      const btnEdit = document.createElement('button');
      btnEdit.type = 'button';
      btnEdit.className = 'btn btn-secondary btn-sm';
      btnEdit.style.marginRight = '0.35rem';
      btnEdit.textContent = 'Sửa';
      btnEdit.addEventListener('click', () => openEditStudentModal(st));
      tdActions.appendChild(btnEdit);

      const btnDel = document.createElement('button');
      btnDel.type = 'button';
      btnDel.className = 'btn btn-danger btn-sm';
      btnDel.textContent = 'Xóa';
      btnDel.addEventListener('click', () => confirmDeleteStudent(st));
      tdActions.appendChild(btnDel);

      tr.appendChild(tdActions);
      tableBody.appendChild(tr);
    });
  }

  function updateOverviewStats(students) {
    const totalEl = document.getElementById('stat-total-students');
    const majorsEl = document.getElementById('stat-total-majors');
    const avgGpaEl = document.getElementById('stat-avg-gpa');
    const newStudentsEl = document.getElementById('stat-new-students');

    if (!AppState.isBackendConnected || !students || students.length === 0) {
      if (totalEl) totalEl.textContent = '--';
      if (majorsEl) majorsEl.textContent = '--';
      if (avgGpaEl) avgGpaEl.textContent = '--';
      if (newStudentsEl) newStudentsEl.textContent = '--';
      return;
    }

    // Tính toán số liệu thật từ danh sách
    const total = students.length;
    const majorsSet = new Set(students.map(s => (s.major || '').trim()).filter(Boolean));
    const validGpas = students.map(s => parseFloat(s.gpa)).filter(v => !isNaN(v));
    const avgGpa = validGpas.length > 0 ? (validGpas.reduce((a, b) => a + b, 0) / validGpas.length).toFixed(2) : '0.00';

    // Sinh viên mới (trong 7 ngày hoặc sinh viên có created_at gần nhất)
    let newCount = 0;
    const now = new Date();
    students.forEach(s => {
      if (s.created_at) {
        const cd = new Date(s.created_at);
        if (!isNaN(cd.getTime()) && (now - cd) < 7 * 24 * 3600 * 1000) {
          newCount++;
        }
      }
    });

    if (totalEl) totalEl.textContent = String(total);
    if (majorsEl) majorsEl.textContent = String(majorsSet.size);
    if (avgGpaEl) avgGpaEl.textContent = String(avgGpa);
    if (newStudentsEl) newStudentsEl.textContent = String(newCount || Math.min(total, 1));
  }

  // =========================================================================
  // Chi tiết sinh viên (Modal View)
  // =========================================================================
  function viewStudentDetail(st) {
    const modal = document.getElementById('view-student-modal');
    const content = document.getElementById('view-student-content');
    if (!modal || !content) return;

    let avatarHtml = '';
    if (st.avatar_key) {
      avatarHtml = `<img src="/api/files/profile-pics/${encodeURIComponent(st.avatar_key)}" alt="Avatar" style="width: 90px; height: 90px; border-radius: 50%; object-fit: cover; border: 2px solid var(--color-blue-500);">`;
    } else {
      avatarHtml = `<div style="width: 90px; height: 90px; border-radius: 50%; background: #e2e8f0; display: flex; align-items: center; justify-content: center; font-size: 2rem; font-weight: bold; color: #475569;">${escapeHtml((st.fullname || 'S').charAt(0).toUpperCase())}</div>`;
    }

    content.innerHTML = `
      <div style="display: flex; gap: 1.5rem; align-items: center; margin-bottom: 1.5rem;">
        ${avatarHtml}
        <div>
          <h3 style="margin-bottom: 0.25rem; font-size: 1.3rem;">${escapeHtml(st.fullname)}</h3>
          <p style="color: #64748b; font-size: 0.9rem;">Mã SV: <code class="inline-code">${escapeHtml(st.student_id)}</code></p>
          <p style="margin-top: 0.35rem;"><span class="gpa-badge ${getGpaBadgeClass(st.gpa)}">GPA: ${parseFloat(st.gpa || 0).toFixed(2)}</span></p>
        </div>
      </div>
      <table class="detail-table">
        <tbody>
          <tr><th>ID Hệ Thống</th><td>${escapeHtml(st.id)}</td></tr>
          <tr><th>Mã Sinh Viên</th><td><code>${escapeHtml(st.student_id)}</code></td></tr>
          <tr><th>Họ và Tên</th><td>${escapeHtml(st.fullname)}</td></tr>
          <tr><th>Ngày Sinh</th><td>${escapeHtml(formatDate(st.dob))}</td></tr>
          <tr><th>Chuyên Ngành</th><td>${escapeHtml(st.major)}</td></tr>
          <tr><th>Điểm GPA</th><td>${parseFloat(st.gpa || 0).toFixed(2)} / 4.00</td></tr>
          <tr><th>Avatar Key MinIO</th><td><code>${escapeHtml(st.avatar_key || 'Chưa có')}</code></td></tr>
          <tr><th>Ngày Khởi Tạo</th><td>${escapeHtml(formatDateTime(st.created_at))}</td></tr>
        </tbody>
      </table>
    `;

    modal.classList.add('show');
    modal.setAttribute('aria-hidden', 'false');
  }

  // =========================================================================
  // Thêm Sinh viên mới (Form Add Student & Upload MinIO)
  // =========================================================================
  async function handleAddStudent(e) {
    e.preventDefault();
    const form = e.target;
    const submitBtn = form.querySelector('button[type="submit"]');
    const alertBox = document.getElementById('add-student-alert');

    const studentId = form.student_id.value.trim();
    const fullname = form.fullname.value.trim();
    const dob = form.dob.value;
    const major = form.major.value.trim();
    const gpa = parseFloat(form.gpa.value);
    const avatarFileInput = form.avatar_file;

    // Validate phía client
    const idRegex = /^[A-Za-z0-9_-]{1,10}$/;
    if (!idRegex.test(studentId)) {
      showFormAlert(alertBox, 'Mã sinh viên phải từ 1 đến 10 ký tự, chỉ chứa chữ cái, số, gạch nối (-) hoặc gạch dưới (_).', 'danger');
      return;
    }
    if (!fullname || fullname.length > 100) {
      showFormAlert(alertBox, 'Họ tên là bắt buộc và tối đa 100 ký tự.', 'danger');
      return;
    }
    if (!dob) {
      showFormAlert(alertBox, 'Vui lòng chọn ngày sinh hợp lệ.', 'danger');
      return;
    }
    const dobDate = new Date(dob);
    if (dobDate > new Date()) {
      showFormAlert(alertBox, 'Ngày sinh không được nằm trong tương lai.', 'danger');
      return;
    }
    if (!major || major.length > 50) {
      showFormAlert(alertBox, 'Chuyên ngành là bắt buộc và tối đa 50 ký tự.', 'danger');
      return;
    }
    if (isNaN(gpa) || gpa < 0 || gpa > 4) {
      showFormAlert(alertBox, 'Điểm GPA phải là số từ 0.00 đến 4.00.', 'danger');
      return;
    }

    setButtonLoading(submitBtn, true, 'Đang lưu sinh viên...');

    try {
      let avatarKey = null;

      // Nếu có chọn file ảnh đại diện, upload lên bucket profile-pics trước
      if (avatarFileInput && avatarFileInput.files && avatarFileInput.files.length > 0) {
        const file = avatarFileInput.files[0];
        if (file.size > 10 * 1024 * 1024) {
          throw new Error('Ảnh đại diện không được vượt quá 10 MiB.');
        }

        const formData = new FormData();
        formData.append('bucket', 'profile-pics');
        formData.append('file', file);

        const uploadRes = await fetch('/api/files', {
          method: 'POST',
          body: formData
        });

        if (!uploadRes.ok) {
          const errData = await uploadRes.json().catch(() => ({}));
          throw new Error(errData.error || `Tải ảnh lên MinIO thất bại (HTTP ${uploadRes.status})`);
        }

        const uploadResult = await uploadRes.json();
        avatarKey = uploadResult.key;
      }

      // Tạo sinh viên qua POST /api/students-db
      const payload = {
        student_id: studentId,
        fullname: fullname,
        dob: dob,
        major: major,
        gpa: gpa,
        avatar_key: avatarKey
      };

      const res = await fetch('/api/students-db', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Lỗi server khi thêm sinh viên (HTTP ${res.status})`);
      }

      showFormAlert(alertBox, 'Thêm sinh viên thành công vào SQL Server!', 'success');
      form.reset();
      const preview = document.getElementById('add-avatar-preview');
      if (preview) preview.src = '';

      // Tải lại danh sách sinh viên
      setTimeout(() => {
        switchTab('students');
      }, 1000);

    } catch (err) {
      showFormAlert(alertBox, err.message, 'danger');
    } finally {
      setButtonLoading(submitBtn, false, 'Lưu sinh viên');
    }
  }

  // =========================================================================
  // Sửa sinh viên (Modal Edit & PUT /api/students-db/{id})
  // =========================================================================
  let editingStudent = null;

  function openEditStudentModal(st) {
    editingStudent = st;
    const modal = document.getElementById('edit-student-modal');
    const form = document.getElementById('edit-student-form');
    const alertBox = document.getElementById('edit-student-alert');
    if (!modal || !form) return;

    if (alertBox) alertBox.style.display = 'none';

    form.student_id.value = st.student_id || '';
    form.fullname.value = st.fullname || '';
    form.dob.value = st.dob ? st.dob.split('T')[0] : '';
    form.major.value = st.major || '';
    form.gpa.value = st.gpa !== undefined ? st.gpa : '0';
    form.current_avatar_key.value = st.avatar_key || '';

    const preview = document.getElementById('edit-avatar-preview');
    if (preview) {
      if (st.avatar_key) {
        preview.src = `/api/files/profile-pics/${encodeURIComponent(st.avatar_key)}`;
        preview.style.display = 'block';
      } else {
        preview.style.display = 'none';
      }
    }

    modal.classList.add('show');
    modal.setAttribute('aria-hidden', 'false');
  }

  async function handleEditStudentSubmit(e) {
    e.preventDefault();
    if (!editingStudent) return;

    const form = e.target;
    const submitBtn = form.querySelector('button[type="submit"]');
    const alertBox = document.getElementById('edit-student-alert');

    const studentId = form.student_id.value.trim();
    const fullname = form.fullname.value.trim();
    const dob = form.dob.value;
    const major = form.major.value.trim();
    const gpa = parseFloat(form.gpa.value);
    const newAvatarInput = form.edit_avatar_file;
    let avatarKey = form.current_avatar_key.value || null;

    // Validate
    if (!/^[A-Za-z0-9_-]{1,10}$/.test(studentId)) {
      showFormAlert(alertBox, 'Mã sinh viên phải từ 1 đến 10 ký tự.', 'danger');
      return;
    }
    if (!fullname || fullname.length > 100) {
      showFormAlert(alertBox, 'Họ tên tối đa 100 ký tự.', 'danger');
      return;
    }
    if (!dob) {
      showFormAlert(alertBox, 'Vui lòng chọn ngày sinh.', 'danger');
      return;
    }
    if (!major || major.length > 50) {
      showFormAlert(alertBox, 'Ngành học tối đa 50 ký tự.', 'danger');
      return;
    }
    if (isNaN(gpa) || gpa < 0 || gpa > 4) {
      showFormAlert(alertBox, 'Điểm GPA từ 0.00 đến 4.00.', 'danger');
      return;
    }

    setButtonLoading(submitBtn, true, 'Đang cập nhật...');

    try {
      // Nếu có chọn ảnh mới, upload lên MinIO trước
      if (newAvatarInput && newAvatarInput.files && newAvatarInput.files.length > 0) {
        const file = newAvatarInput.files[0];
        const formData = new FormData();
        formData.append('bucket', 'profile-pics');
        formData.append('file', file);

        const uploadRes = await fetch('/api/files', { method: 'POST', body: formData });
        if (!uploadRes.ok) {
          const errData = await uploadRes.json().catch(() => ({}));
          throw new Error(errData.error || 'Lỗi tải ảnh mới lên MinIO');
        }
        const uploadResult = await uploadRes.json();
        avatarKey = uploadResult.key;
      }

      // Hợp đồng API: PUT gửi đủ các trường bắt buộc
      const payload = {
        student_id: studentId,
        fullname: fullname,
        dob: dob,
        major: major,
        gpa: gpa,
        avatar_key: avatarKey
      };

      const res = await fetch(`/api/students-db/${editingStudent.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Lỗi cập nhật sinh viên (HTTP ${res.status})`);
      }

      closeModal('edit-student-modal');
      loadStudents();

    } catch (err) {
      showFormAlert(alertBox, err.message, 'danger');
    } finally {
      setButtonLoading(submitBtn, false, 'Lưu thay đổi');
    }
  }

  // =========================================================================
  // Xóa sinh viên (Modal Confirm & DELETE /api/students-db/{id})
  // =========================================================================
  let deletingStudent = null;

  function confirmDeleteStudent(st) {
    deletingStudent = st;
    const modal = document.getElementById('delete-student-modal');
    const msg = document.getElementById('delete-confirm-msg');
    if (!modal) return;

    if (msg) {
      msg.textContent = `Bạn có chắc chắn muốn xóa sinh viên "${st.fullname}" (Mã SV: ${st.student_id}) khỏi hệ thống cơ sở dữ liệu SQL Server? Thao tác này không thể hoàn tác.`;
    }

    modal.classList.add('show');
    modal.setAttribute('aria-hidden', 'false');
  }

  async function executeDeleteStudent() {
    if (!deletingStudent) return;
    const btn = document.getElementById('btn-confirm-delete');
    setButtonLoading(btn, true, 'Đang xóa...');

    try {
      const res = await fetch(`/api/students-db/${deletingStudent.id}`, {
        method: 'DELETE',
        headers: { 'Accept': 'application/json' }
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Lỗi khi xóa sinh viên (HTTP ${res.status})`);
      }

      closeModal('delete-student-modal');
      deletingStudent = null;
      loadStudents();

    } catch (err) {
      alert(`Xóa thất bại: ${err.message}`);
    } finally {
      setButtonLoading(btn, false, 'Xác nhận xóa');
    }
  }

  // =========================================================================
  // Quản lý Lưu trữ Tệp (MinIO S3 - GET /api/files & POST /api/files)
  // =========================================================================
  async function loadFilesList() {
    const listBody = document.getElementById('files-table-body');
    const loadingRow = document.getElementById('files-loading');
    const emptyRow = document.getElementById('files-empty');
    const alertBox = document.getElementById('storage-alert');

    if (loadingRow) loadingRow.style.display = 'table-row';
    if (emptyRow) emptyRow.style.display = 'none';

    try {
      const res = await fetch('/api/files?bucket=documents', {
        headers: { 'Accept': 'application/json' },
        cache: 'no-store'
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const data = await res.json();
      const files = Array.isArray(data.files) ? data.files : [];

      renderFilesTable(files);
      if (alertBox) alertBox.style.display = 'none';

    } catch (err) {
      if (alertBox) {
        alertBox.style.display = 'block';
        alertBox.className = 'alert alert-warning';
        alertBox.textContent = `Không thể tải danh sách tệp từ MinIO: ${err.message}. Đảm bảo container object-storage-server và backend đã hoạt động.`;
      }
      renderFilesTable([]);
    } finally {
      if (loadingRow) loadingRow.style.display = 'none';
    }
  }

  function renderFilesTable(files) {
    const listBody = document.getElementById('files-table-body');
    const emptyRow = document.getElementById('files-empty');
    if (!listBody) return;

    const rows = listBody.querySelectorAll('tr:not(#files-loading):not(#files-empty)');
    rows.forEach(r => r.remove());

    if (!files || files.length === 0) {
      if (emptyRow) emptyRow.style.display = 'table-row';
      return;
    }
    if (emptyRow) emptyRow.style.display = 'none';

    files.forEach(f => {
      const tr = document.createElement('tr');

      const tdKey = document.createElement('td');
      const codeKey = document.createElement('code');
      codeKey.className = 'inline-code';
      codeKey.textContent = f.key || '--';
      tdKey.appendChild(codeKey);
      tr.appendChild(tdKey);

      const tdSize = document.createElement('td');
      tdSize.textContent = formatFileSize(f.size);
      tr.appendChild(tdSize);

      const tdDate = document.createElement('td');
      tdDate.textContent = formatDateTime(f.last_modified);
      tr.appendChild(tdDate);

      const tdAction = document.createElement('td');
      const downloadLink = document.createElement('a');
      downloadLink.className = 'btn btn-secondary btn-sm';
      // Hợp đồng API: /api/files/documents/<key>
      downloadLink.href = f.download_url || `/api/files/documents/${encodeURIComponent(f.key)}`;
      downloadLink.setAttribute('download', f.key || 'document.pdf');
      downloadLink.textContent = 'Tải về';
      tdAction.appendChild(downloadLink);
      tr.appendChild(tdAction);

      listBody.appendChild(tr);
    });
  }

  async function handleFileUpload(e) {
    e.preventDefault();
    const form = e.target;
    const fileInput = form.file_input;
    const submitBtn = form.querySelector('button[type="submit"]');
    const alertBox = document.getElementById('upload-file-alert');

    if (!fileInput.files || fileInput.files.length === 0) {
      showFormAlert(alertBox, 'Vui lòng chọn một tệp PDF cần tải lên.', 'danger');
      return;
    }

    const file = fileInput.files[0];
    if (file.size > 10 * 1024 * 1024) {
      showFormAlert(alertBox, 'Kích thước tệp không được vượt quá 10 MiB.', 'danger');
      return;
    }

    setButtonLoading(submitBtn, true, 'Đang tải lên MinIO...');

    try {
      const formData = new FormData();
      formData.append('bucket', 'documents');
      formData.append('file', file);

      const res = await fetch('/api/files', {
        method: 'POST',
        body: formData
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Tải tệp thất bại (HTTP ${res.status})`);
      }

      showFormAlert(alertBox, 'Tải tài liệu PDF lên bucket documents thành công!', 'success');
      form.reset();
      loadFilesList();

    } catch (err) {
      showFormAlert(alertBox, err.message, 'danger');
    } finally {
      setButtonLoading(submitBtn, false, 'Tải lên');
    }
  }

  // =========================================================================
  // Keycloak OIDC Authentication với PKCE (S256)
  // =========================================================================
  // Hàm sinh chuỗi ngẫu nhiên
  function generateRandomString(length) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
    let result = '';
    const randomValues = new Uint8Array(length);
    window.crypto.getRandomValues(randomValues);
    for (let i = 0; i < length; i++) {
      result += chars[randomValues[i] % chars.length];
    }
    return result;
  }

  // Mã hóa Base64 URL không padding
  function base64UrlEncode(arrayBuffer) {
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }

  // Tạo code_challenge bằng SHA-256
  async function generateCodeChallenge(codeVerifier) {
    const encoder = new TextEncoder();
    const data = encoder.encode(codeVerifier);
    const digest = await window.crypto.subtle.digest('SHA-256', data);
    return base64UrlEncode(digest);
  }

  async function loadAuthConfig() {
    const authStatusEl = document.getElementById('auth-status-text');
    const authDescEl = document.getElementById('auth-config-desc');

    try {
      const res = await fetch('/api/auth/config', { headers: { 'Accept': 'application/json' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const config = await res.json();
      AppState.authConfig = config;

      if (authDescEl) {
        authDescEl.innerHTML = `
          <strong>OIDC Config:</strong> Issuer: <code>${escapeHtml(config.issuer)}</code> | Client ID: <code>${escapeHtml(config.client_id || 'flask-app')}</code>
        `;
      }
    } catch (err) {
      if (authDescEl) {
        authDescEl.textContent = 'Chưa tải được cấu hình OIDC từ GET /api/auth/config. Keycloak hoặc Backend có thể chưa chạy.';
      }
    }
  }

  // Bắt đầu luồng đăng nhập OIDC PKCE
  async function initiateKeycloakLogin() {
    if (!AppState.authConfig || !AppState.authConfig.authorization_endpoint) {
      await loadAuthConfig();
    }

    if (!AppState.authConfig || !AppState.authConfig.authorization_endpoint) {
      alert('Không lấy được cấu hình đăng nhập OIDC từ backend. Vui lòng kiểm tra lại dịch vụ Keycloak.');
      return;
    }

    const codeVerifier = generateRandomString(64);
    const codeChallenge = await generateCodeChallenge(codeVerifier);
    const state = generateRandomString(32);
    const redirectUri = window.location.origin + '/app/';

    // Lưu vào sessionStorage để đối chiếu khi callback
    sessionStorage.setItem('pkce_code_verifier', codeVerifier);
    sessionStorage.setItem('pkce_state', state);

    const authUrl = new URL(AppState.authConfig.authorization_endpoint);
    authUrl.searchParams.set('client_id', AppState.authConfig.client_id || 'flask-app');
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('scope', 'openid profile email');
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('code_challenge', codeChallenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');

    // Chuyển hướng trình duyệt tới trang đăng nhập Keycloak
    window.location.href = authUrl.toString();
  }

  // Xử lý callback sau khi Keycloak chuyển hướng về /app/?code=...&state=...
  async function handleOidcCallback() {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');

    if (!code || !state) return;

    // Chuyển sang tab Account ngay để hiển thị kết quả
    switchTab('account');

    const savedState = sessionStorage.getItem('pkce_state');
    const codeVerifier = sessionStorage.getItem('pkce_code_verifier');

    // Xóa ngay code và state khỏi URL để tránh lộ token/code trong browser history
    window.history.replaceState({}, document.title, window.location.pathname);

    const alertBox = document.getElementById('account-alert');

    if (!savedState || state !== savedState) {
      showFormAlert(alertBox, 'Lỗi bảo mật OIDC: State không khớp hoặc phiên đăng nhập đã hết hạn.', 'danger');
      return;
    }

    if (!codeVerifier) {
      showFormAlert(alertBox, 'Lỗi bảo mật: Thiếu code_verifier trong phiên.', 'danger');
      return;
    }

    // Đổi authorization code lấy token tại token_endpoint
    try {
      if (!AppState.authConfig) await loadAuthConfig();
      const tokenEndpoint = AppState.authConfig ? AppState.authConfig.token_endpoint : null;

      if (!tokenEndpoint) {
        throw new Error('Không tìm thấy token_endpoint trong cấu hình OIDC.');
      }

      const redirectUri = window.location.origin + '/app/';
      const bodyParams = new URLSearchParams();
      bodyParams.set('grant_type', 'authorization_code');
      bodyParams.set('client_id', AppState.authConfig.client_id || 'flask-app');
      bodyParams.set('code', code);
      bodyParams.set('redirect_uri', redirectUri);
      bodyParams.set('code_verifier', codeVerifier);

      const tokenRes = await fetch(tokenEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: bodyParams.toString()
      });

      if (!tokenRes.ok) {
        const errJson = await tokenRes.json().catch(() => ({}));
        throw new Error(errJson.error_description || errJson.error || `Lỗi đổi token (HTTP ${tokenRes.status})`);
      }

      const tokenData = await tokenRes.json();
      AppState.accessToken = tokenData.access_token;
      sessionStorage.setItem('mycloud_access_token', tokenData.access_token);

      // Dọn dẹp verifier
      sessionStorage.removeItem('pkce_code_verifier');
      sessionStorage.removeItem('pkce_state');

      updateAuthUI(true, 'Đăng nhập Keycloak thành công!');

      // Tự động kiểm tra /api/secure
      testSecureResource();

    } catch (err) {
      showFormAlert(alertBox, `Xác thực OIDC thất bại: ${err.message}`, 'danger');
      updateAuthUI(false);
    }
  }

  // Gọi GET /api/secure với Bearer token thật
  async function testSecureResource() {
    const alertBox = document.getElementById('secure-test-alert');
    const resultBox = document.getElementById('secure-test-result');

    const token = AppState.accessToken || sessionStorage.getItem('mycloud_access_token');
    if (!token) {
      showFormAlert(alertBox, 'Chưa có Access Token. Vui lòng đăng nhập qua Keycloak trước.', 'warning');
      if (resultBox) resultBox.textContent = 'Chưa có token để gửi request.';
      return;
    }

    try {
      const res = await fetch('/api/secure', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        showFormAlert(alertBox, `Xác minh thành công từ Backend! (HTTP ${res.status} OK)`, 'success');
        if (resultBox) {
          resultBox.textContent = JSON.stringify(data, null, 2);
        }
        if (data.preferred_username) {
          const userPill = document.getElementById('topbar-user-pill');
          if (userPill) {
            userPill.textContent = `User: ${data.preferred_username}`;
            userPill.style.display = 'inline-flex';
          }
        }
      } else {
        showFormAlert(alertBox, `Backend từ chối token (HTTP ${res.status}): ${data.error || res.statusText}`, 'danger');
        if (resultBox) {
          resultBox.textContent = JSON.stringify(data, null, 2);
        }
      }
    } catch (err) {
      showFormAlert(alertBox, `Lỗi gửi request tới /api/secure: ${err.message}`, 'danger');
    }
  }

  function handleLogout() {
    AppState.accessToken = null;
    sessionStorage.removeItem('mycloud_access_token');
    const userPill = document.getElementById('topbar-user-pill');
    if (userPill) userPill.style.display = 'none';

    updateAuthUI(false, 'Đã đăng xuất.');

    const resultBox = document.getElementById('secure-test-result');
    if (resultBox) resultBox.textContent = 'Chưa thực hiện kiểm tra.';
  }

  function updateAuthUI(isLoggedIn, msg = '') {
    const statusText = document.getElementById('auth-status-text');
    const loginBtn = document.getElementById('btn-keycloak-login');
    const logoutBtn = document.getElementById('btn-keycloak-logout');
    const testSecureBtn = document.getElementById('btn-test-secure');
    const alertBox = document.getElementById('account-alert');

    if (isLoggedIn) {
      if (statusText) statusText.innerHTML = '<span class="badge badge-healthy">Đã đăng nhập (Authenticated)</span>';
      if (loginBtn) loginBtn.style.display = 'none';
      if (logoutBtn) logoutBtn.style.display = 'inline-flex';
      if (testSecureBtn) testSecureBtn.disabled = false;
      if (msg && alertBox) showFormAlert(alertBox, msg, 'success');
    } else {
      if (statusText) statusText.innerHTML = '<span class="badge badge-unknown">Chưa đăng nhập</span>';
      if (loginBtn) loginBtn.style.display = 'inline-flex';
      if (logoutBtn) logoutBtn.style.display = 'none';
      if (testSecureBtn) testSecureBtn.disabled = true;
      if (msg && alertBox) showFormAlert(alertBox, msg, 'info');
    }
  }

  // =========================================================================
  // API Documentation Interactive Runner
  // =========================================================================
  async function runApiTest(endpoint, method) {
    const statusBadge = document.getElementById('api-runner-status');
    const responseBox = document.getElementById('api-runner-response');
    const urlDisplay = document.getElementById('api-runner-url');

    if (urlDisplay) urlDisplay.textContent = `${method} ${endpoint}`;
    if (statusBadge) {
      statusBadge.className = 'badge badge-unknown';
      statusBadge.textContent = 'Đang gọi...';
    }
    if (responseBox) responseBox.textContent = 'Đang tải phản hồi...';

    const startTime = performance.now();

    try {
      const res = await fetch(endpoint, {
        method: method,
        headers: { 'Accept': 'application/json' },
        cache: 'no-store'
      });

      const elapsed = Math.round(performance.now() - startTime);
      let data = null;
      const text = await res.text();
      try {
        data = JSON.parse(text);
      } catch (e) {
        data = text;
      }

      if (statusBadge) {
        statusBadge.className = 'badge ' + (res.ok ? 'badge-healthy' : 'badge-unhealthy');
        statusBadge.textContent = `HTTP ${res.status} ${res.statusText} (${elapsed}ms)`;
      }

      if (responseBox) {
        if (typeof data === 'object') {
          responseBox.textContent = JSON.stringify(data, null, 2);
        } else {
          responseBox.textContent = data;
        }
      }
    } catch (err) {
      if (statusBadge) {
        statusBadge.className = 'badge badge-unhealthy';
        statusBadge.textContent = 'Lỗi kết nối';
      }
      if (responseBox) {
        responseBox.textContent = `Lỗi mạng: Không thể kết nối đến ${endpoint} (${err.message}).`;
      }
    }
  }

  // =========================================================================
  // Helper UI Utilities
  // =========================================================================
  function showFormAlert(el, message, type) {
    if (!el) return;
    el.style.display = 'block';
    el.className = `alert alert-${type}`;
    el.textContent = message;
  }

  function setButtonLoading(btn, isLoading, text) {
    if (!btn) return;
    btn.disabled = isLoading;
    if (isLoading) {
      btn.setAttribute('data-original-text', btn.textContent);
      btn.textContent = text;
    } else {
      btn.textContent = btn.getAttribute('data-original-text') || text;
    }
  }

  function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove('show');
      modal.setAttribute('aria-hidden', 'true');
    }
  }

  // =========================================================================
  // Khởi tạo và Lắng nghe sự kiện khi nạp trang
  // =========================================================================
  document.addEventListener('DOMContentLoaded', () => {
    // 1. Điều hướng tabs
    document.querySelectorAll('[data-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-tab');
        switchTab(tab);
      });
    });

    // 2. Tìm kiếm sinh viên với Debounce
    let searchTimer = null;
    const searchInput = document.getElementById('search-student-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
          loadStudents(e.target.value);
        }, 300);
      });
    }

    // Nút làm mới sinh viên
    const refreshBtn = document.getElementById('btn-refresh-students');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        if (searchInput) searchInput.value = '';
        loadStudents();
      });
    }

    // 3. Form thêm sinh viên
    const addStudentForm = document.getElementById('add-student-form');
    if (addStudentForm) {
      addStudentForm.addEventListener('submit', handleAddStudent);
    }

    // Preview avatar khi chọn file ở form thêm
    const avatarInput = document.getElementById('add-avatar-file');
    const avatarPreview = document.getElementById('add-avatar-preview');
    if (avatarInput && avatarPreview) {
      avatarInput.addEventListener('change', () => {
        if (avatarInput.files && avatarInput.files[0]) {
          const reader = new FileReader();
          reader.onload = (e) => {
            avatarPreview.src = e.target.result;
            avatarPreview.style.display = 'block';
          };
          reader.readAsDataURL(avatarInput.files[0]);
        }
      });
    }

    // 4. Form sửa sinh viên
    const editForm = document.getElementById('edit-student-form');
    if (editForm) {
      editForm.addEventListener('submit', handleEditStudentSubmit);
    }

    // 5. Xác nhận xóa sinh viên
    const btnConfirmDelete = document.getElementById('btn-confirm-delete');
    if (btnConfirmDelete) {
      btnConfirmDelete.addEventListener('click', executeDeleteStudent);
    }

    // 6. Form tải lên tài liệu MinIO
    const uploadFileForm = document.getElementById('upload-document-form');
    if (uploadFileForm) {
      uploadFileForm.addEventListener('submit', handleFileUpload);
    }

    const refreshFilesBtn = document.getElementById('btn-refresh-files');
    if (refreshFilesBtn) {
      refreshFilesBtn.addEventListener('click', loadFilesList);
    }

    // 7. Xác thực Keycloak OIDC
    const loginBtn = document.getElementById('btn-keycloak-login');
    if (loginBtn) {
      loginBtn.addEventListener('click', initiateKeycloakLogin);
    }

    const logoutBtn = document.getElementById('btn-keycloak-logout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', handleLogout);
    }

    const testSecureBtn = document.getElementById('btn-test-secure');
    if (testSecureBtn) {
      testSecureBtn.addEventListener('click', testSecureResource);
    }

    // 8. Đóng modal chung
    document.querySelectorAll('[data-close-modal]').forEach(btn => {
      btn.addEventListener('click', () => {
        const modal = btn.closest('.modal-backdrop');
        if (modal) {
          modal.classList.remove('show');
          modal.setAttribute('aria-hidden', 'true');
        }
      });
    });

    document.querySelectorAll('.modal-backdrop').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.classList.remove('show');
          modal.setAttribute('aria-hidden', 'true');
        }
      });
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal-backdrop.show').forEach(modal => {
          modal.classList.remove('show');
          modal.setAttribute('aria-hidden', 'true');
        });
      }
    });

    // 9. Interactive API doc test buttons
    document.querySelectorAll('[data-api-test]').forEach(btn => {
      btn.addEventListener('click', () => {
        const endpoint = btn.getAttribute('data-endpoint');
        const method = btn.getAttribute('data-method') || 'GET';
        runApiTest(endpoint, method);
      });
    });

    // 10. Toggle mobile sidebar
    const toggleSidebarBtn = document.getElementById('mobile-sidebar-toggle');
    const sidebar = document.getElementById('app-sidebar');
    if (toggleSidebarBtn && sidebar) {
      toggleSidebarBtn.addEventListener('click', () => {
        sidebar.classList.toggle('open');
      });
    }

    // Kiểm tra token đã lưu từ trước
    const savedToken = sessionStorage.getItem('mycloud_access_token');
    if (savedToken) {
      AppState.accessToken = savedToken;
      updateAuthUI(true, 'Khôi phục phiên đăng nhập từ session.');
    }

    // Kiểm tra nếu đang có OIDC authorization code callback trong URL
    if (window.location.search.includes('code=')) {
      handleOidcCallback();
    } else {
      // Khởi động mặc định tải danh sách sinh viên
      loadStudents();
      loadAuthConfig();
    }
  });
})();
