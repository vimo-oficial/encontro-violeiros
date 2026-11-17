(() => {
  const $ = id => document.getElementById(id);
  const panel = $('attendancePanel');
  if (!panel) return;
  let people = [], busy = false, drawing = false, history = [], noRepeat = true;
  const normalize = v => String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const escape = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const notice = text => { $('attendanceNotice').textContent = text; $('raffleNotice').textContent = text; };
  async function api(method = 'GET', body, action = 'attendance') {
    const response = await fetch('/api/event/'+action, { method, cache:'no-store', headers:{'Content-Type':'application/json'}, ...(body ? {body:JSON.stringify(body)} : {}) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Não foi possível carregar a lista.');
    return data;
  }
  function render() {
    const present = people.filter(p => p.checked_in_at);
    $('attendanceTotal').textContent = people.length;
    $('attendancePresent').textContent = present.length;
    $('attendanceWaiting').textContent = people.length - present.length;
    const unique = [...new Map(present.map(p=>[p.id,p])).values()];
    $('raffleTotal').textContent = unique.length;
    $('raffleDraw').disabled = drawing || busy || !unique.some(p=>!noRepeat || !history.some(d=>d.participant_id===p.id));
    const raffleTerm = normalize($('raffleSearch').value);
    const raffleRows = unique.filter(p=>normalize(p.full_name+' '+p.city+' '+p.participant_number).includes(raffleTerm));
    $('raffleList').innerHTML = raffleRows.length ? raffleRows.map(p=>'<div class="attendance-person is-present"><div><strong>'+escape(p.full_name)+'</strong><small>Nº '+escape(p.participant_number)+' · '+escape(p.city)+'/'+escape(p.state)+'</small></div><span>Presente</span></div>').join('') : '<div class="empty-state">'+(unique.length?'Nenhum participante encontrado nesta busca.':'Ainda não há participantes para o sorteio. Marque as presenças na aba Recepção.')+'</div>';
    const term = normalize($('attendanceSearch').value), filter = $('attendanceFilter').value;
    const rows = people.filter(p => normalize(p.full_name+' '+p.city+' '+p.participant_number).includes(term) && (filter === 'all' || (filter === 'present' ? !!p.checked_in_at : !p.checked_in_at)));
    $('attendanceList').innerHTML = rows.length ? rows.map(p => '<div class="attendance-person '+(p.checked_in_at?'is-present':'')+'"><div class="attendance-person-info"><strong>'+escape(p.full_name)+'</strong><small>Nº '+escape(p.participant_number)+' · '+escape(p.city)+'/'+escape(p.state)+'</small></div><div class="arrival-actions">'+(p.checked_in_at?'<span class="arrival-badge">✓ Presente · '+new Date(p.checked_in_at).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})+'</span><button type="button" class="btn btn-ghost arrival-undo" data-person="'+escape(p.id)+'" data-present="false" '+(busy||drawing?'disabled':'')+' aria-label="Desmarcar presença de '+escape(p.full_name)+'">Desmarcar</button>':'<button type="button" class="btn btn-primary arrival-confirm" data-person="'+escape(p.id)+'" data-present="true" '+(busy||drawing?'disabled':'')+' aria-label="Confirmar chegada de '+escape(p.full_name)+'">Confirmar chegada</button>')+'</div></div>').join('') : '<div class="empty-state">'+(people.length?'Nenhum participante encontrado neste filtro.':'Nenhum participante confirmado ainda.')+'</div>';
    $('statPresent').textContent=present.length;
    $('raffleEligible').textContent=unique.filter(p=>!noRepeat || !history.some(d=>d.participant_id===p.id)).length;
    $('raffleNoRepeat').disabled=drawing || busy;

  }
  async function refresh() {
    if(busy || drawing) return false;
    busy = true; $('attendanceRefresh').disabled = true; $('raffleRefresh').disabled = true;
    try { people = await api(); await loadRaffle(); notice('Atualizado às '+new Date().toLocaleTimeString('pt-BR')+'. Presenças salvas no sistema.'); return true; }
    catch(error) { notice(error.message+' A lista pode estar desatualizada.'); return false; }
    finally { busy = false; $('attendanceRefresh').disabled = false; $('raffleRefresh').disabled = false; render(); }
  }
  document.querySelectorAll('[data-admin-view]').forEach(button => button.addEventListener('click', () => {
    const view = button.dataset.adminView;
    document.body.dataset.adminView=view;
    panel.hidden = view !== 'attendance';
    $('rafflePanel').hidden = view !== 'raffle';
    $('registrationsPanel').hidden = view !== 'registrations';
    document.querySelectorAll('[data-admin-view]').forEach(b => { const active = b === button; b.setAttribute('aria-pressed',active); b.classList.toggle('btn-primary',active); b.classList.toggle('btn-ghost',!active); });
    if(view !== 'registrations') refresh();
  }));
  $('attendanceSearch').addEventListener('input',render);
  $('attendanceFilter').addEventListener('change',render);
  $('attendanceRefresh').addEventListener('click',refresh);
  $('attendanceList').addEventListener('click',async event => {
    const input = event.target.closest('[data-person]');
    if(!input) return;
    const person = people.find(p=>p.id === input.dataset.person), present = input.dataset.present === 'true';
    if(!person || busy || drawing) { render(); return; }
    if(!present && !confirm('Desmarcar a presença de '+person.full_name+'? Essa pessoa sairá da lista para sorteio.')) {render();return;}
    busy = true; render(); notice('Salvando presença…');
    try {
      const result = await api('PATCH',{id:person.id,present});
      person.checked_in_at = result.checked_in_at;
      notice(person.full_name+': '+(present?'presença registrada.':'presença desmarcada.'));
    } catch(error) {notice('Não foi possível salvar: '+error.message);}
    finally {busy = false;render();}
  });

  async function loadRaffle() {
    const data = await api('GET',null,'raffle');
    history=data.history; noRepeat=data.no_repeat;
    $('raffleNoRepeat').checked=noRepeat;
    $('raffleHistory').innerHTML=history.length ? history.map(d=>'<div class="history-row"><strong>'+escape(d.full_name)+'</strong><span>Nº '+escape(d.participant_number)+' · '+escape(d.city)+'/'+escape(d.state)+'</span><small>'+escape(new Date(d.created_at).toLocaleString('pt-BR'))+'</small></div>').join('') : '<p>Nenhum sorteio realizado ainda.</p>';
  }
  $('raffleNoRepeat').addEventListener('change',async()=>{
    const input=$('raffleNoRepeat');input.disabled=true;
    try {await api('PATCH',{no_repeat:input.checked},'raffle');await loadRaffle();render();}
    catch(error){input.checked=noRepeat;notice(error.message);}
    finally{input.disabled=false;}
  });
  let priorFocus=null;
  $('raffleScreen').addEventListener('click',()=>{
    priorFocus=document.activeElement;
    $('raffleStage').classList.add('presentation');
    $('raffleStage').setAttribute('role','dialog'); $('raffleStage').setAttribute('aria-modal','true');
    document.body.classList.add('presenting-raffle');
    $('raffleExit').focus();
  });
  const exit=()=>{
    $('raffleStage').classList.remove('presentation');
    $('raffleStage').removeAttribute('role'); $('raffleStage').removeAttribute('aria-modal');
    document.body.classList.remove('presenting-raffle');
    priorFocus?.focus();
  };
  $('raffleExit').addEventListener('click',exit);
  document.addEventListener('keydown',e=>{
    if(!$('raffleStage').classList.contains('presentation')) return;
    if(e.key==='Escape') {exit(); return;}
    if(e.key==='Tab'){
      const buttons=[...$('raffleStage').querySelectorAll('button:not(:disabled)')];
      const first=buttons[0],last=buttons[buttons.length-1];
      if(e.shiftKey && document.activeElement===first){e.preventDefault();last?.focus();}
      else if(!e.shiftKey && document.activeElement===last){e.preventDefault();first?.focus();}
    }
  });
  let pendingDrawId = null;
  $('raffleDraw').addEventListener('click', async () => {
    if(drawing || busy) return;
    drawing = true;
    const button = $('raffleDraw'), countdown = $('raffleCountdown'), result = $('raffleResult');
    button.disabled = true; button.textContent = 'Preparando sorteio…';
    result.innerHTML = '<p>Conferindo participantes presentes…</p>';
    render();
    try {
      people = await api();
      if(!people.some(p=>p.checked_in_at)) throw new Error('Nenhum participante presente. Marque as presenças na recepção.');
      countdown.hidden = false; countdown.textContent = '5';
      button.textContent = 'Sorteio em andamento…';
      result.innerHTML = '<p>Aguarde a contagem. O resultado aparecerá aqui.</p>';
      const deadline = performance.now() + 5000;
      await new Promise(resolve => {
        const tick = () => {
          const remaining = Math.max(0, Math.ceil((deadline-performance.now())/1000));
          countdown.textContent = String(remaining);
          if(remaining === 0) resolve(); else setTimeout(tick, Math.min(200, deadline-performance.now()));
        };
        tick();
      });
      button.textContent = 'Selecionando participante…';
      pendingDrawId ||= crypto.randomUUID();
      const winner = await api('POST',{request_id:pendingDrawId},'raffle');
      pendingDrawId=null;
      result.innerHTML = '<span class="raffle-stage-label">Participante sorteado</span><strong class="raffle-winner">'+escape(winner.full_name)+'</strong><p>Nº '+escape(winner.participant_number)+' · '+escape(winner.city)+'/'+escape(winner.state)+'</p>';
      notice('Sorteio concluído. Resultado salvo no histórico.');
      try {await loadRaffle();} catch {notice('Resultado salvo. Atualize para carregar o histórico.');}
    } catch(error) {
      result.innerHTML = '<p>'+escape(error.message || 'Não foi possível concluir o sorteio. Tente novamente.')+'</p>';
    } finally {
      drawing = false; countdown.hidden = true; button.textContent = 'Sortear participante'; render();
    }
  });

  $('raffleSearch').addEventListener('input',render);
  $('raffleRefresh').addEventListener('click',refresh);
  setInterval(()=>{if((!panel.hidden || !$('rafflePanel').hidden) && !document.hidden) refresh();},15000);
})();
