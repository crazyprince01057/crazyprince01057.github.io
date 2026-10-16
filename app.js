(() => {
  'use strict';
  document.documentElement.classList.add('js-ready');

  const storageKey = 'aifadian.public.work-note.v1';
  const names = ['title', 'purpose', 'process', 'usage', 'limits', 'rights'];
  const maximums = { title: 50, purpose: 300, process: 500, usage: 500, limits: 500, rights: 400 };
  const definitions = {
    tool: {
      name: '工具与工作流',
      tip: '适合小工具、自动化、教程与工作流。写清环境和实际验证范围。',
      labels: ['作品名称', '给谁用，解决什么问题', '人工取舍与 AI 参与', '如何使用或复现', '已验证范围与限制', '素材、署名与公开权限'],
      hints: [
        '用一个具体名称说明这是什么。最多 50 字。',
        '使用者、具体场景，以及输入和输出。最多 300 字。',
        '你定义、筛选或修改了什么；AI 负责哪一段。无需填写私密提示词。最多 500 字。',
        '准备条件、主要步骤和结果检查方法。最多 500 字。',
        '实际测过什么；没测过的明确写“未验证”。最多 500 字。',
        '写清来源、许可和可以公开的部分。无法确认的写“待确认”，先不要公开。最多 400 字。'
      ]
    },
    visual: {
      name: '视觉与视频',
      tip: '适合图像、短片、设计与视觉实验。写清创作取舍和素材的公开权限。',
      labels: ['作品名称', '作品表达与观看场景', '人工取舍与 AI 参与', '制作过程与呈现方式', '已核对事项与限制', '素材、署名与公开权限'],
      hints: [
        '给这张图、这段视频或这组设计一个名称。最多 50 字。',
        '想表达什么、给谁看，以及作品的形式。最多 300 字。',
        '你决定了哪些构图、叙事或剪辑；AI 参与哪一步。无需填写私密提示词。最多 500 字。',
        '素材到成品的主要步骤，观看方式和必要条件。最多 500 字。',
        '实际核对过什么，哪些细节、效果或权利还待确认。最多 500 字。',
        '写清图像、音乐、字体等来源与许可。无法确认的写“待确认”，先不要公开。最多 400 字。'
      ]
    }
  };
  const examples = {
    tool: {
      title: '收据文件整理工作流（模板演示）',
      purpose: '虚构示例：为需要归档收据的人，把文件按日期和用途整理成清单。输入为有权使用的示例文件，输出为供人工核对的命名建议。',
      process: '人工先定义命名规则、挑选示例并核对结果；AI 协助起草规则说明。这个演示没有真实程序或已运行的模型。',
      usage: '演示写法：先复制一组脱敏示例文件，再按规则生成建议；人工检查日期与名称，确认后再操作原文件。没有可下载执行程序。',
      limits: '仅为说明字段写法的虚构场景；未做运行、准确率、批量处理或真实设备验证，不代表已完成的产品。',
      rights: '文字为模板演示，不含真实票据或客户信息。使用者需另行核实自己材料的来源、署名与公开权限。'
    },
    visual: {
      title: '一张纸的光影练习（模板演示）',
      purpose: '虚构示例：用一张纸的折痕和阴影表达安静的日常，形式是一张静态图。本站没有对应的真实作品成品。',
      process: '演示写法：人工决定构图、画面节奏与最终取舍；AI 参与草图探索。这里没有实际生成记录，不代表已完成创作。',
      usage: '演示写法：先确定构图，再比较草图、手动调整局部，最后导出用于屏幕观看的图片。具体软件与导出规格待真实创作者填写。',
      limits: '未核验打印效果、色彩一致性或商业使用条件。所有过程仅为字段写法示例，不能当作真实作品证据。',
      rights: '仅有原创模板文字，不含真实第三方图片、音乐或人物。正式发布前应逐项确认素材、工具条款、授权及署名。'
    }
  };

  const $ = (id) => document.getElementById(id);
  const inputs = Object.fromEntries(names.map((name) => [name, $(`work-${name}`)]));
  const blankDraft = () => ({ values: Object.fromEntries(names.map((name) => [name, ''])), demo: false });
  let drafts = { tool: blankDraft(), visual: blankDraft() };
  let currentType = 'tool';
  const results = { tool: null, visual: null };
  let pendingAction = null;
  let pendingOrigin = null;
  let lastSavedSignature = null;
  let toastTimer;
  let generationBusy = false;
  let manualCopyOrigin = null;

  function notify(message) {
    const toast = $('toast');
    toast.textContent = message;
    toast.classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('visible'), 4500);
  }

  function allSignature() {
    return JSON.stringify({ currentType, drafts });
  }

  function currentSignature() {
    return JSON.stringify(drafts[currentType]);
  }

  function hasContent(draft = drafts[currentType]) {
    return names.some((name) => draft.values[name].trim());
  }

  function clearErrors() {
    for (const name of names) {
      inputs[name].removeAttribute('aria-invalid');
      $(`error-${name}`).hidden = true;
      $(`error-${name}`).textContent = '';
    }
    $('form-error').hidden = true;
    $('form-error').textContent = '';
  }

  function updateDraftIndicator() {
    $('draft-indicator').textContent = lastSavedSignature === allSignature()
      ? '已保存当前内容'
      : lastSavedSignature ? '有未保存更改' : '未保存当前内容';
  }

  function renderForm() {
    const definition = definitions[currentType];
    document.querySelectorAll('[data-type]').forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.type === currentType));
    });
    $('type-tip').textContent = definition.tip;
    names.forEach((name, index) => {
      $(`label-${name}`).textContent = definition.labels[index];
      $(`hint-${name}`).textContent = definition.hints[index];
      inputs[name].value = drafts[currentType].values[name];
    });
    $('demo-banner').hidden = !drafts[currentType].demo;
    clearErrors();
    renderPreview();
    updateDraftIndicator();
  }

  function renderPreview() {
    const result = results[currentType];
    const fresh = Boolean(result && result.signature === currentSignature());
    $('preview-empty').hidden = Boolean(result);
    $('preview-content').hidden = !result;
    $('copy-preview').disabled = !fresh;
    $('download-preview').disabled = !fresh;
    $('preview-status').classList.toggle('stale', Boolean(result && !fresh));
    if (!result) {
      $('preview-label').textContent = '等待填写';
      $('preview-status').textContent = '生成内容仅在当前页面展示，不会发布。';
      return;
    }
    $('preview-label').textContent = fresh ? (result.demo ? '模板演示' : '待你核对') : '需要重新整理';
    $('preview-title').textContent = result.values.title;
    $('preview-category').textContent = `${definitions[currentType].name} / ${result.demo ? '虚构模板示例' : '填写者提供的作品事实'}`;
    $('preview-demo').hidden = !result.demo;
    const fragment = document.createDocumentFragment();
    names.slice(1).forEach((name, index) => {
      const section = document.createElement('section');
      section.className = 'preview-section';
      const title = document.createElement('h5');
      title.textContent = definitions[currentType].labels[index + 1];
      const paragraph = document.createElement('p');
      paragraph.textContent = result.values[name];
      section.append(title, paragraph);
      fragment.append(section);
    });
    $('preview-sections').replaceChildren(fragment);
    $('preview-status').textContent = fresh
      ? '已按固定模板整理。请核对事实、权限与署名后，再复制或下载。'
      : '字段已有修改。当前显示上一次的说明，请重新整理后再复制或下载。';
  }

  function cancelConfirmation(restoreFocus = true) {
    $('confirmation').hidden = true;
    pendingAction = null;
    if (restoreFocus && pendingOrigin) pendingOrigin.focus();
    pendingOrigin = null;
  }

  function confirmAction(message, buttonText, action, origin) {
    pendingAction = action;
    pendingOrigin = origin;
    $('confirm-text').textContent = message;
    $('confirm-action').textContent = buttonText;
    $('confirmation').hidden = false;
    $('confirmation').scrollIntoView({ block: 'nearest', behavior: 'auto' });
    $('confirm-action').focus();
  }

  $('confirm-action').addEventListener('click', () => {
    const action = pendingAction;
    cancelConfirmation(false);
    if (action) action();
  });
  $('cancel-action').addEventListener('click', () => cancelConfirmation());

  document.querySelectorAll('[data-type]').forEach((button) => {
    button.addEventListener('click', () => {
      if (button.dataset.type === currentType || generationBusy) return;
      cancelConfirmation(false);
      currentType = button.dataset.type;
      renderForm();
      notify(`已切换到${definitions[currentType].name}，另一类的输入仍保留在本页。`);
    });
  });

  for (const name of names) {
    inputs[name].addEventListener('input', () => {
      drafts[currentType].values[name] = inputs[name].value;
      if (inputs[name].value.trim()) {
        inputs[name].removeAttribute('aria-invalid');
        $(`error-${name}`).hidden = true;
      }
      if (!$('form-error').hidden) {
        const remaining = names.filter((field) => inputs[field].getAttribute('aria-invalid') === 'true').length;
        $('form-error').hidden = remaining === 0;
        $('form-error').textContent = remaining ? `还有 ${remaining} 项需要补充，已在对应字段下标出。` : '';
      }
      renderPreview();
      updateDraftIndicator();
    });
  }

  $('work-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    if (generationBusy) return;
    cancelConfirmation(false);
    clearErrors();
    const invalid = [];
    names.forEach((name, index) => {
      const value = inputs[name].value.trim();
      if (!value || value.length > maximums[name]) {
        const message = value ? `最多填写 ${maximums[name]} 字。` : `请填写“${definitions[currentType].labels[index]}”；尚不清楚的内容可以写“待确认”或“未验证”。`;
        inputs[name].setAttribute('aria-invalid', 'true');
        $(`error-${name}`).textContent = message;
        $(`error-${name}`).hidden = false;
        invalid.push(name);
      }
    });
    if (invalid.length) {
      $('form-error').textContent = `还有 ${invalid.length} 项需要补充，已在对应字段下标出。`;
      $('form-error').hidden = false;
      inputs[invalid[0]].focus();
      return;
    }
    generationBusy = true;
    $('generate').disabled = true;
    $('generate').textContent = '正在整理…';
    $('preview-paper').setAttribute('aria-busy', 'true');
    // Yield one frame for accessible busy feedback; all processing remains local.
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const values = Object.fromEntries(names.map((name) => [name, inputs[name].value.trim()]));
    results[currentType] = { values, demo: drafts[currentType].demo, signature: currentSignature() };
    renderPreview();
    generationBusy = false;
    $('generate').disabled = false;
    $('generate').textContent = '整理为一页说明 →';
    $('preview-paper').removeAttribute('aria-busy');
    notify('说明已整理，请先核对再分享。');
    if (window.matchMedia('(max-width: 800px)').matches) {
      $('preview-heading').scrollIntoView({ block: 'start', behavior: 'auto' });
    }
  });

  function useExample() {
    drafts[currentType] = { values: { ...examples[currentType] }, demo: true };
    results[currentType] = null;
    renderForm();
    inputs.title.focus();
    notify('已载入虚构模板演示。生成和导出都会保留演示标记。');
  }

  $('load-example').addEventListener('click', (event) => {
    if (hasContent()) {
      confirmAction('载入演示会替换当前这一类的编辑内容。已存本机草稿和另一类输入不受影响。', '替换为模板演示', useExample, event.currentTarget);
    } else useExample();
  });

  $('reset-editor').addEventListener('click', (event) => {
    if (!hasContent()) { notify('当前编辑内容已经为空。'); return; }
    confirmAction('清空当前这一类的编辑与预览？已存本机草稿和另一类输入不受影响。', '清空当前编辑', () => {
      drafts[currentType] = blankDraft();
      results[currentType] = null;
      renderForm();
      inputs.title.focus();
      notify('当前编辑与预览已清空。');
    }, event.currentTarget);
  });

  function readSaved() {
    const raw = window.localStorage.getItem(storageKey);
    if (raw === null) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.version !== 1 || !['tool', 'visual'].includes(parsed.currentType) || !parsed.drafts || !Number.isFinite(Date.parse(parsed.savedAt))) throw new Error('invalid-draft');
    const cleanDrafts = {};
    for (const type of ['tool', 'visual']) {
      const item = parsed.drafts[type];
      if (!item || typeof item.demo !== 'boolean' || !item.values) throw new Error('invalid-draft');
      const values = {};
      for (const name of names) {
        if (typeof item.values[name] !== 'string' || item.values[name].length > maximums[name]) throw new Error('invalid-draft');
        values[name] = item.values[name];
      }
      cleanDrafts[type] = { values, demo: item.demo };
    }
    return { currentType: parsed.currentType, drafts: cleanDrafts, savedAt: parsed.savedAt };
  }

  function storageMessage(message, error = false) {
    $('storage-status').textContent = message;
    $('storage-status').classList.toggle('error', error);
  }

  function checkSaved() {
    try {
      const saved = readSaved();
      $('restore-draft').disabled = !saved;
      $('delete-draft').disabled = !saved;
      if (saved) storageMessage('找到已存的本机草稿。点击“恢复草稿”后才会填入，不会自动恢复。');
    } catch (error) {
      let hasRaw = false;
      try { hasRaw = window.localStorage.getItem(storageKey) !== null; } catch (_) { /* Reading may be blocked by browser privacy settings. */ }
      $('restore-draft').disabled = true;
      $('delete-draft').disabled = !hasRaw;
      storageMessage(hasRaw ? '已存草稿格式无法识别，可删除后重新保存。当前编辑仍可复制或下载。' : '浏览器不允许读取本地存储。你仍可整理、复制或下载，请勿依赖本机保存。', true);
    }
  }

  $('save-draft').addEventListener('click', () => {
    if (!hasContent(drafts.tool) && !hasContent(drafts.visual)) {
      storageMessage('请先填写内容，再保存本机草稿。', true);
      return;
    }
    try {
      window.localStorage.setItem(storageKey, JSON.stringify({ version: 1, savedAt: new Date().toISOString(), currentType, drafts }));
      lastSavedSignature = allSignature();
      $('restore-draft').disabled = false;
      $('delete-draft').disabled = false;
      updateDraftIndicator();
      storageMessage('已保存两类作品的当前输入，仅存于此站点、此浏览器。之后的更改需再次点击保存。');
      notify('本机草稿已保存。');
    } catch (_) {
      storageMessage('保存失败：浏览器可能限制存储或空间不足。内容仍在当前页面，请复制或下载保留。', true);
      notify('本机保存失败，请复制或下载保留。');
    }
  });

  $('restore-draft').addEventListener('click', (event) => {
    const restore = () => {
      try {
        const saved = readSaved();
        if (!saved) { checkSaved(); storageMessage('没有找到已存草稿。当前编辑未改动。', true); return; }
        drafts = saved.drafts;
        currentType = saved.currentType;
        results.tool = null;
        results.visual = null;
        lastSavedSignature = allSignature();
        renderForm();
        storageMessage('草稿已恢复。请重新整理生成预览，复制或下载前核对事实。');
        inputs.title.focus();
        notify('已恢复本机草稿。');
      } catch (_) {
        storageMessage('恢复失败：草稿不可读取或格式异常。当前编辑未改动，可复制或下载保留。', true);
      }
    };
    if (hasContent(drafts.tool) || hasContent(drafts.visual)) confirmAction('恢复会替换两类作品的当前输入，并清空页面预览。未保存的修改将丢失。', '恢复已存草稿', restore, event.currentTarget);
    else restore();
  });

  $('delete-draft').addEventListener('click', (event) => {
    confirmAction('删除此站点已存的本机草稿？当前页面的编辑内容仍会保留。删除后无法从本地存储恢复。', '删除已存草稿', () => {
      try {
        window.localStorage.removeItem(storageKey);
        lastSavedSignature = null;
        $('restore-draft').disabled = true;
        $('delete-draft').disabled = true;
        updateDraftIndicator();
        storageMessage('已删除本机草稿。当前编辑仍在本页，关闭页面后不会保留。');
        notify('已存草稿已删除，当前编辑保留。');
      } catch (_) { storageMessage('删除失败：浏览器未允许修改存储。请使用浏览器站点设置管理本地数据。', true); }
    }, event.currentTarget);
  });

  function outputText(result) {
    const definition = definitions[currentType];
    const lines = ['AI 发电 / 作品说明', result.demo ? '模板演示 · 虚构示例，不代表真实作品' : '填写者提供的作品事实，公开前请核对', '', result.values.title, `类型：${definition.name}`, ''];
    names.slice(1).forEach((name, index) => lines.push(`【${definition.labels[index + 1]}】`, result.values[name], ''));
    lines.push('说明：由填写者提供事实，AI 发电按固定模板整理，未调用模型。请核对事实、素材许可和署名后再公开。');
    return lines.join('\n');
  }

  async function copyText(text, successMessage, origin) {
    try {
      if (!navigator.clipboard || !navigator.clipboard.writeText) throw new Error('clipboard-unavailable');
      await navigator.clipboard.writeText(text);
      notify(successMessage);
    } catch (_) {
      manualCopyOrigin = origin;
      $('manual-copy-text').value = text;
      $('manual-copy').hidden = false;
      $('manual-copy').scrollIntoView({ block: 'center', behavior: 'auto' });
      $('manual-copy-text').focus();
      $('manual-copy-text').select();
      notify('浏览器未允许直接复制，已选中文字，请手动复制。');
    }
  }

  $('copy-preview').addEventListener('click', () => {
    const result = results[currentType];
    if (result && result.signature === currentSignature()) copyText(outputText(result), '作品说明已复制。', $('copy-preview'));
  });

  $('download-preview').addEventListener('click', () => {
    const result = results[currentType];
    if (!result || result.signature !== currentSignature()) return;
    try {
      const blob = new Blob(['\uFEFF', outputText(result)], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const filename = result.values.title.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-').slice(0, 45) || '作品说明';
      link.href = url;
      link.download = `${filename}-AI发电.txt`;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      notify('已发起文本下载，请检查浏览器下载列表。');
    } catch (_) { notify('无法发起下载，请复制说明保留。'); }
  });

  $('copy-opener').addEventListener('click', () => copyText($('cooperation-opener').textContent.trim(), '合作开场已复制，请到小红书站内自行发送。', $('copy-opener')));
  $('select-copy').addEventListener('click', () => { $('manual-copy-text').focus(); $('manual-copy-text').select(); });
  $('close-copy').addEventListener('click', () => { $('manual-copy').hidden = true; if (manualCopyOrigin) manualCopyOrigin.focus(); });

  const menuToggle = $('menu-toggle');
  const navigation = $('main-nav');
  function closeMenu() { menuToggle.setAttribute('aria-expanded', 'false'); navigation.classList.remove('open'); }
  menuToggle.addEventListener('click', () => {
    const open = menuToggle.getAttribute('aria-expanded') === 'true';
    menuToggle.setAttribute('aria-expanded', String(!open));
    navigation.classList.toggle('open', !open);
  });
  navigation.querySelectorAll('a').forEach((link) => link.addEventListener('click', closeMenu));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      if (!$('confirmation').hidden) cancelConfirmation();
      if (menuToggle.getAttribute('aria-expanded') === 'true') { closeMenu(); menuToggle.focus(); }
    }
  });

  renderForm();
  checkSaved();
})();
