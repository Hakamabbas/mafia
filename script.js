/* ========================================================
   1. تعريف المتغيرات والأدوار الجديدة
======================================================== */
const ROLES = {
    MAFIA: 'مافيا 🔪',
    NURSE: 'ممرضة 💊',
    SNIPER: 'قناص 🎯',
    CITIZEN: 'مواطن 👨‍🌾',
    MAYOR: 'العمدة 🎩',
    BANDIT: 'زعيم العصابة 🦹‍♂️',
    SHERIFF: 'الشريف 🕵️‍♂️',
    BOMBER: 'حامل الديناميت 🧨'
};

let players = [];            
let alivePlayers = [];       
let currentTurnIndex = 0;    
let currentPhase = '';       

let nightActions = {
    mafiaTarget: null,
    nurseTarget: null,
    sniperTarget: null
};

let votes = {};
let sniperShotUsed = false;  
let selectedOption = null;   

const screens = {
    setup: document.getElementById('setup-screen'),
    passPhone: document.getElementById('pass-phone-screen'),
    action: document.getElementById('action-screen'),
    morning: document.getElementById('morning-screen'),
    voting: document.getElementById('voting-screen'),
    votingResults: document.getElementById('voting-results-screen'),
    gameOver: document.getElementById('game-over-screen')
};

function showScreen(screenName) {
    Object.values(screens).forEach(screen => screen.classList.add('hidden'));
    screens[screenName].classList.remove('hidden');
}

/* ========================================================
   2. إعداد اللعبة وإضافة اللاعبين
======================================================== */
const playerNameInput = document.getElementById('player-name-input');
const addPlayerBtn = document.getElementById('add-player-btn');
const playersList = document.getElementById('players-list');
const playerCountDisplay = document.getElementById('player-count-display');
const setupErrorMsg = document.getElementById('setup-error-msg');

addPlayerBtn.addEventListener('click', addPlayer);
playerNameInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') addPlayer(); });

function addPlayer() {
    const name = playerNameInput.value.trim();
    if (name === '') return showError('لا يمكنك ترك الاسم فارغاً!');
    if (players.some(p => p.name === name)) return showError('هذا الاسم موجود مسبقاً!');
    
    players.push({ name: name, role: null, isAlive: true });
    
    const li = document.createElement('li');
    li.textContent = name;
    
    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = '❌';
    deleteBtn.style.background = 'none';
    deleteBtn.style.border = 'none';
    deleteBtn.style.boxShadow = 'none';
    deleteBtn.style.color = 'var(--blood-red)';
    deleteBtn.onclick = () => {
        players = players.filter(p => p.name !== name);
        li.remove();
        updatePlayerCount();
    };
    
    li.appendChild(deleteBtn);
    playersList.appendChild(li);
    playerNameInput.value = '';
    setupErrorMsg.classList.add('hidden');
    updatePlayerCount();
}

function updatePlayerCount() { playerCountDisplay.textContent = players.length; }
function showError(msg) { setupErrorMsg.textContent = msg; setupErrorMsg.classList.remove('hidden'); }

/* ========================================================
   3. بدء اللعبة وتوزيع الأدوار الجديدة
======================================================== */
document.getElementById('start-game-btn').addEventListener('click', () => {
    const mafiaCount = parseInt(document.getElementById('mafia-count').value);
    
    // التحقق من الشخصيات الإضافية
    const useMayor = document.getElementById('role-mayor').checked;
    const useBandit = document.getElementById('role-bandit').checked;
    const useSheriff = document.getElementById('role-sheriff').checked;
    const useBomber = document.getElementById('role-bomber').checked;

    let extraRoles = 0;
    if(useMayor) extraRoles++;
    if(useBandit) extraRoles++;
    if(useSheriff) extraRoles++;
    if(useBomber) extraRoles++;

    // مافيا + ممرضة + قناص + أدوار إضافية + 1 مواطن على الأقل
    const minPlayers = mafiaCount + 2 + extraRoles + 1; 

    if (players.length < minPlayers) {
        return showError(`بهذه الإعدادات، تحتاج إلى ${minPlayers} لاعبين على الأقل.`);
    }

    assignRoles(mafiaCount, useMayor, useBandit, useSheriff, useBomber);
    startNightPhase();
});

function assignRoles(mafiaCount, useMayor, useBandit, useSheriff, useBomber) {
    let rolesArray = [];
    
    for (let i = 0; i < mafiaCount; i++) rolesArray.push(ROLES.MAFIA);
    rolesArray.push(ROLES.NURSE);
    rolesArray.push(ROLES.SNIPER);
    
    if(useMayor) rolesArray.push(ROLES.MAYOR);
    if(useBandit) rolesArray.push(ROLES.BANDIT);
    if(useSheriff) rolesArray.push(ROLES.SHERIFF);
    if(useBomber) rolesArray.push(ROLES.BOMBER);
    
    while (rolesArray.length < players.length) {
        rolesArray.push(ROLES.CITIZEN);
    }

    for (let i = rolesArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [rolesArray[i], rolesArray[j]] = [rolesArray[j], rolesArray[i]];
    }

    players.forEach((p, index) => p.role = rolesArray[index]);
}

/* ========================================================
   4. إدارة مرحلة الليل
======================================================== */
function startNightPhase() {
    currentPhase = 'NIGHT';
    alivePlayers = players.filter(p => p.isAlive);
    currentTurnIndex = 0;
    nightActions = { mafiaTarget: null, nurseTarget: null, sniperTarget: null };
    nextTurn();
}

function nextTurn() {
    selectedOption = null;
    if (currentTurnIndex < alivePlayers.length) {
        const currentPlayer = alivePlayers[currentTurnIndex];
        document.getElementById('target-player-name').textContent = currentPlayer.name;
        document.getElementById('ready-player-name').textContent = currentPlayer.name;
        showScreen('passPhone');
    } else {
        processNightResults();
    }
}

document.getElementById('ready-btn').addEventListener('click', () => {
    currentPhase === 'NIGHT' ? showNightActionScreen() : showVotingScreenForPlayer();
});

function showNightActionScreen() {
    const currentPlayer = alivePlayers[currentTurnIndex];
    const roleTitle = document.getElementById('role-title');
    const roleDesc = document.getElementById('role-description');
    const actionContent = document.getElementById('action-content');
    const confirmBtn = document.getElementById('confirm-action-btn');
    
    actionContent.innerHTML = '';
    confirmBtn.classList.add('hidden');
    roleTitle.textContent = `دورك: ${currentPlayer.role}`;

    // المافيا أو زعيم العصابة يختارون ضحية
    if (currentPlayer.role === ROLES.MAFIA || currentPlayer.role === ROLES.BANDIT) {
        roleDesc.textContent = "اختر ضحيتك لهذه الليلة:";
        createPlayerOptions(alivePlayers.filter(p => p.name !== currentPlayer.name), actionContent, confirmBtn);
    } 
    else if (currentPlayer.role === ROLES.NURSE) {
        roleDesc.textContent = "من تريد أن تحمي من القتل هذه الليلة؟";
        createPlayerOptions(alivePlayers, actionContent, confirmBtn);
    } 
    else if (currentPlayer.role === ROLES.SNIPER) {
        if (sniperShotUsed) {
            roleDesc.textContent = "لقد استنفدت رصاصتك مسبقاً 🚫";
            createSkipOption(actionContent, confirmBtn);
        } else {
            roleDesc.textContent = "لديك رصاصة واحدة! يمكنك قتل لاعب أو التخطي.";
            createPlayerOptions(alivePlayers.filter(p => p.name !== currentPlayer.name), actionContent, confirmBtn, true);
        }
    } 
    // الشريف (المحقق)
    else if (currentPlayer.role === ROLES.SHERIFF) {
        roleDesc.textContent = "اختر لاعباً للتحقيق في هويته (ستعرف إن كان من الأشرار أم لا):";
        createPlayerOptions(alivePlayers.filter(p => p.name !== currentPlayer.name), actionContent, confirmBtn);
    }
    // المواطن، العمدة، أو المفجر يحلون مسألة لتمرير الوقت
    else {
        roleDesc.textContent = "حل هذه المسألة ليمر الوقت دون إثارة الشبهات:";
        createMathProblem(actionContent, confirmBtn);
    }

    showScreen('action');
}

function createPlayerOptions(list, container, confirmBtn, allowSkip = false) {
    list.forEach(p => {
        const btn = document.createElement('button');
        btn.className = 'option-btn';
        btn.textContent = p.name;
        btn.onclick = () => {
            document.querySelectorAll('#action-content .option-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            selectedOption = p.name;
            confirmBtn.classList.remove('hidden');
        };
        container.appendChild(btn);
    });
    if (allowSkip) createSkipOption(container, confirmBtn);
}

function createSkipOption(container, confirmBtn) {
    const skipBtn = document.createElement('button');
    skipBtn.className = 'option-btn';
    skipBtn.textContent = 'تخطي';
    skipBtn.onclick = () => {
        document.querySelectorAll('#action-content .option-btn').forEach(b => b.classList.remove('selected'));
        skipBtn.classList.add('selected');
        selectedOption = 'SKIP';
        confirmBtn.classList.remove('hidden');
    };
    container.appendChild(skipBtn);
}

function createMathProblem(container, confirmBtn) {
    const num1 = Math.floor(Math.random() * 10) + 1;
    const num2 = Math.floor(Math.random() * 10) + 1;
    const correctAns = num1 + num2;
    const pt = document.createElement('h3');
    pt.textContent = `${num1} + ${num2} = ؟`;
    container.appendChild(pt);

    let answers = [correctAns, correctAns + 1, correctAns - 1, correctAns + 2].sort(() => Math.random() - 0.5);
    answers.forEach(ans => {
        const btn = document.createElement('button');
        btn.className = 'option-btn';
        btn.textContent = ans;
        btn.onclick = () => {
            if (ans === correctAns) {
                document.querySelectorAll('#action-content .option-btn').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                selectedOption = 'SOLVED';
                confirmBtn.classList.remove('hidden');
            } else alert('إجابة خاطئة!');
        };
        container.appendChild(btn);
    });
}

document.getElementById('confirm-action-btn').addEventListener('click', () => {
    const currentPlayer = alivePlayers[currentTurnIndex];
    
    if ((currentPlayer.role === ROLES.MAFIA || currentPlayer.role === ROLES.BANDIT) && selectedOption !== 'SKIP') {
        nightActions.mafiaTarget = selectedOption;
    }
    if (currentPlayer.role === ROLES.NURSE && selectedOption !== 'SKIP') nightActions.nurseTarget = selectedOption;
    if (currentPlayer.role === ROLES.SNIPER && selectedOption !== 'SKIP') {
        nightActions.sniperTarget = selectedOption;
        sniperShotUsed = true;
    }
    
    // إظهار نتيجة التحقيق للشريف فوراً قبل تمرير الهاتف
    if (currentPlayer.role === ROLES.SHERIFF && selectedOption !== 'SKIP') {
        const target = players.find(p => p.name === selectedOption);
        const isEvil = (target.role === ROLES.MAFIA || target.role === ROLES.BANDIT);
        alert(`نتائج التحقيق السري 🕵️‍♂️:\nاللاعب (${selectedOption}) هو: ${isEvil ? 'شرير / مافيا 🔪' : 'بريء 👨‍🌾'}`);
    }

    currentTurnIndex++;
    nextTurn();
});

/* ========================================================
   5. معالجة نتائج الليل وشاشة الصباح
======================================================== */
function processNightResults() {
    let deadThisNight = [];
    let newsMessage = "";

    // المافيا تقتل
    if (nightActions.mafiaTarget) {
        if (nightActions.mafiaTarget !== nightActions.nurseTarget) {
            deadThisNight.push(nightActions.mafiaTarget);
            newsMessage += `تم العثور على 💀 ${nightActions.mafiaTarget} مقتولاً في ظروف غامضة.<br>`;
        } else {
            newsMessage += `حاول الأشرار القتل، لكن الممرضة 💊 تدخلت وأنقذت الضحية!<br>`;
        }
    }

    // القناص يضرب
    if (nightActions.sniperTarget && nightActions.sniperTarget !== 'SKIP') {
        const targetPlayer = players.find(p => p.name === nightActions.sniperTarget);
        const sniperPlayer = players.find(p => p.role === ROLES.SNIPER);

        if (targetPlayer.role === ROLES.BANDIT) {
            newsMessage += `سُمع صوت رصاصة قناص 🎯، لكن الهدف كان (زعيم العصابة) ونجا بفضل درعه!<br>`;
        } else if (targetPlayer.role === ROLES.MAFIA) {
            if (nightActions.sniperTarget !== nightActions.nurseTarget && !deadThisNight.includes(targetPlayer.name)) {
                deadThisNight.push(targetPlayer.name);
                newsMessage += `القناص 🎯 قضى على المافيا ${targetPlayer.name}.<br>`;
            }
        } else {
            if (sniperPlayer && !deadThisNight.includes(sniperPlayer.name)) {
                deadThisNight.push(sniperPlayer.name);
                newsMessage += `أخطأ القناص 🎯 هدفه وصوب على شخص بريء، فانتحر لشعوره بالعار!<br>`;
            }
        }
    }

    // قدرة حامل الديناميت
    const bomber = players.find(p => p.role === ROLES.BOMBER);
    if (bomber && deadThisNight.includes(bomber.name)) {
        // إذا مات المفجر، نختار أحد الأشرار الأحياء ليموت معه
        const aliveEvils = players.filter(p => p.isAlive && !deadThisNight.includes(p.name) && (p.role === ROLES.MAFIA || p.role === ROLES.BANDIT));
        if (aliveEvils.length > 0) {
            const randomEvil = aliveEvils[Math.floor(Math.random() * aliveEvils.length)];
            deadThisNight.push(randomEvil.name);
            newsMessage += `💥 كارثة! قتلت المافيا (حامل الديناميت)، فانفجر المكان ومات معه الشرير ${randomEvil.name}!<br>`;
        } else {
            newsMessage += `💥 قتلت المافيا (حامل الديناميت)، وانفجر المكان بشكل مروع!<br>`;
        }
    }

    deadThisNight.forEach(deadName => {
        const p = players.find(p => p.name === deadName);
        if (p) p.isAlive = false;
    });

    if (deadThisNight.length === 0) newsMessage = "مرت الليلة بسلام، ولم يمت أحد! 🌅";

    document.getElementById('morning-news').innerHTML = newsMessage;
    showScreen('morning');
    if (checkWinCondition()) return; 
}

/* ========================================================
   6. مرحلة النهار والتصويت (وقدرة العمدة)
======================================================== */
document.getElementById('start-voting-phase-btn').addEventListener('click', startVotingPhase);

function startVotingPhase() {
    currentPhase = 'DAY';
    alivePlayers = players.filter(p => p.isAlive);
    currentTurnIndex = 0;
    votes = {}; 
    alivePlayers.forEach(p => votes[p.name] = 0);
    nextTurn();
}

function showVotingScreenForPlayer() {
    const currentPlayer = alivePlayers[currentTurnIndex];
    document.getElementById('voting-player-name').textContent = currentPlayer.name;
    const votingContent = document.getElementById('voting-content');
    const confirmVoteBtn = document.getElementById('confirm-vote-btn');
    
    votingContent.innerHTML = '';
    confirmVoteBtn.classList.add('hidden');
    selectedOption = null;

    const validTargets = alivePlayers.filter(p => p.name !== currentPlayer.name);
    validTargets.forEach(p => {
        const btn = document.createElement('button');
        btn.className = 'option-btn';
        btn.textContent = p.name;
        btn.onclick = () => {
            document.querySelectorAll('#voting-content .option-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            selectedOption = p.name;
            confirmVoteBtn.classList.remove('hidden');
        };
        votingContent.appendChild(btn);
    });

    const skipBtn = document.createElement('button');
    skipBtn.className = 'option-btn';
    skipBtn.textContent = 'الامتناع عن التصويت';
    skipBtn.onclick = () => {
        document.querySelectorAll('#voting-content .option-btn').forEach(b => b.classList.remove('selected'));
        skipBtn.classList.add('selected');
        selectedOption = 'SKIP';
        confirmVoteBtn.classList.remove('hidden');
    };
    votingContent.appendChild(skipBtn);

    showScreen('voting');
}

document.getElementById('confirm-vote-btn').addEventListener('click', () => {
    const currentPlayer = alivePlayers[currentTurnIndex];
    if (selectedOption !== 'SKIP') {
        // العمدة صوته بـ 2 !
        if (currentPlayer.role === ROLES.MAYOR) {
            votes[selectedOption] += 2;
        } else {
            votes[selectedOption] += 1;
        }
    }
    
    currentTurnIndex++;
    currentTurnIndex < alivePlayers.length ? nextTurn() : processVotingResults();
});

function processVotingResults() {
    let maxVotes = 0;
    let candidates = [];

    for (const [name, count] of Object.entries(votes)) {
        if (count > maxVotes) { maxVotes = count; candidates = [name]; }
        else if (count === maxVotes && count > 0) candidates.push(name);
    }

    const newsElement = document.getElementById('voting-news');
    const continueBtn = document.getElementById('continue-to-night-btn');
    const revoteBtn = document.getElementById('revote-btn');
    
    continueBtn.classList.add('hidden');
    revoteBtn.classList.add('hidden');

    if (maxVotes === 0) {
        newsElement.innerHTML = "امتنع الجميع عن التصويت. لن يُعدم أحد اليوم! ⚖️";
        continueBtn.classList.remove('hidden');
    } else if (candidates.length > 1) {
        newsElement.innerHTML = `تعادلت الأصوات بين: ${candidates.join(' و ')}.<br>القانون يقتضي إعادة التصويت! ⚖️`;
        revoteBtn.classList.remove('hidden');
    } else {
        const executedPlayer = candidates[0];
        const pIndex = players.findIndex(p => p.name === executedPlayer);
        players[pIndex].isAlive = false;
        newsElement.innerHTML = `تم إعدام 🪢 ${executedPlayer}.<br>كان دوره: ${players[pIndex].role}.`;
        continueBtn.classList.remove('hidden');
    }

    showScreen('votingResults');
    if (checkWinCondition()) return;
}

document.getElementById('continue-to-night-btn').addEventListener('click', startNightPhase);
document.getElementById('revote-btn').addEventListener('click', startVotingPhase);

/* ========================================================
   7. شروط الفوز
======================================================== */
function checkWinCondition() {
    // الأشرار هم المافيا وزعيم العصابة
    const aliveEvils = players.filter(p => p.isAlive && (p.role === ROLES.MAFIA || p.role === ROLES.BANDIT)).length;
    const aliveGoodGuys = players.filter(p => p.isAlive && p.role !== ROLES.MAFIA && p.role !== ROLES.BANDIT).length;

    if (aliveEvils === 0) {
        endGame('المواطنين الطيبين 👨‍🌾🎉');
        return true;
    } else if (aliveEvils >= aliveGoodGuys) {
        endGame('المافيا الأشرار 🔪💀');
        return true;
    }
    return false;
}

function endGame(winnerName) {
    document.getElementById('winner-text').innerHTML = `فاز فريق <br>${winnerName}`;
    const survivorsList = document.getElementById('survivors-list');
    survivorsList.innerHTML = '';
    
    players.forEach(p => {
        const li = document.createElement('li');
        li.textContent = `${p.name} - ${p.role}`;
        if (!p.isAlive) {
            li.style.textDecoration = 'line-through';
            li.style.color = 'var(--blood-red)';
            li.textContent += ' (ميت)';
        } else {
            li.style.color = 'var(--safe-green)';
            li.textContent += ' (نجا)';
        }
        survivorsList.appendChild(li);
    });

    showScreen('gameOver');
}

document.getElementById('restart-btn').addEventListener('click', () => {
    players = [];
    playersList.innerHTML = '';
    updatePlayerCount();
    sniperShotUsed = false;
    showScreen('setup');
});
