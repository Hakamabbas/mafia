/* ========================================================
   1. تعريف المتغيرات وحالة اللعبة (Game State)
======================================================== */

// الأدوار المتاحة مع الإيموجيز
const ROLES = {
    MAFIA: 'مافيا 🔪',
    NURSE: 'ممرضة 💊',
    SNIPER: 'قناص 🎯',
    CITIZEN: 'مواطن 👨‍🌾'
};

let players = [];            // مصفوفة اللاعبين { name: '...', role: '...', isAlive: true }
let alivePlayers = [];       // اللاعبون الأحياء فقط
let currentTurnIndex = 0;    // مؤشر دور اللاعب الحالي
let currentPhase = '';       // 'NIGHT' أو 'DAY'

// تسجيل أحداث الليل
let nightActions = {
    mafiaTarget: null,
    nurseTarget: null,
    sniperTarget: null
};

// تسجيل الأصوات في النهار
let votes = {};

// متغيرات القناص
let sniperShotUsed = false;  // هل استنفد القناص رصاصته الوحيدة؟

let selectedOption = null;   // الخيار الذي يحدده اللاعب في الشاشة حالياً


/* ========================================================
   2. جلب العناصر من واجهة المستخدم (DOM Elements)
======================================================== */
const screens = {
    setup: document.getElementById('setup-screen'),
    passPhone: document.getElementById('pass-phone-screen'),
    action: document.getElementById('action-screen'),
    morning: document.getElementById('morning-screen'),
    voting: document.getElementById('voting-screen'),
    votingResults: document.getElementById('voting-results-screen'),
    gameOver: document.getElementById('game-over-screen')
};

// دالة التنقل بين الشاشات
function showScreen(screenName) {
    Object.values(screens).forEach(screen => screen.classList.add('hidden'));
    screens[screenName].classList.remove('hidden');
}


/* ========================================================
   3. إعداد اللعبة وإضافة اللاعبين
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
    
    // زر حذف لاعب
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

function updatePlayerCount() {
    playerCountDisplay.textContent = players.length;
}

function showError(msg) {
    setupErrorMsg.textContent = msg;
    setupErrorMsg.classList.remove('hidden');
}


/* ========================================================
   4. بدء اللعبة وتوزيع الأدوار
======================================================== */
document.getElementById('start-game-btn').addEventListener('click', () => {
    const mafiaCount = parseInt(document.getElementById('mafia-count').value);
    
    // الحد الأدنى للاعبين = عدد المافيا + الممرضة (1) + القناص (1) + مواطن واحد على الأقل (1)
    const minPlayers = mafiaCount + 3; 

    if (players.length < minPlayers) {
        return showError(`تحتاج إلى ${minPlayers} لاعبين على الأقل للبدء بـ ${mafiaCount} مافيا.`);
    }

    assignRoles(mafiaCount);
    startNightPhase();
});

function assignRoles(mafiaCount) {
    let rolesArray = [];
    
    // إضافة المافيا
    for (let i = 0; i < mafiaCount; i++) rolesArray.push(ROLES.MAFIA);
    // إضافة الممرضة والقناص
    rolesArray.push(ROLES.NURSE);
    rolesArray.push(ROLES.SNIPER);
    
    // الباقي مواطنون
    while (rolesArray.length < players.length) {
        rolesArray.push(ROLES.CITIZEN);
    }

    // خلط الأدوار عشوائياً (Fisher-Yates Shuffle)
    for (let i = rolesArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [rolesArray[i], rolesArray[j]] = [rolesArray[j], rolesArray[i]];
    }

    // تعيين الأدوار للاعبين
    players.forEach((p, index) => {
        p.role = rolesArray[index];
    });
}


/* ========================================================
   5. إدارة مرحلة الليل (الأدوار)
======================================================== */
function startNightPhase() {
    currentPhase = 'NIGHT';
    alivePlayers = players.filter(p => p.isAlive);
    currentTurnIndex = 0;
    
    // تصفير اختيارات الليل
    nightActions = { mafiaTarget: null, nurseTarget: null, sniperTarget: null };
    
    nextTurn();
}

function nextTurn() {
    selectedOption = null;
    
    if (currentTurnIndex < alivePlayers.length) {
        // دور لاعب جديد
        const currentPlayer = alivePlayers[currentTurnIndex];
        
        // تجهيز شاشة تمرير الهاتف
        document.getElementById('target-player-name').textContent = currentPlayer.name;
        document.getElementById('ready-player-name').textContent = currentPlayer.name;
        showScreen('passPhone');
    } else {
        // انتهى الليل، نعالج النتائج
        processNightResults();
    }
}

// عندما يضغط اللاعب "أنا مستعد"
document.getElementById('ready-btn').addEventListener('click', () => {
    if (currentPhase === 'NIGHT') {
        showNightActionScreen();
    } else {
        showVotingScreenForPlayer();
    }
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

    // توليد الأزرار حسب الدور
    if (currentPlayer.role === ROLES.MAFIA) {
        roleDesc.textContent = "اختر ضحيتك لهذه الليلة:";
        createPlayerOptions(alivePlayers.filter(p => p.name !== currentPlayer.name), actionContent, confirmBtn);
    } 
    else if (currentPlayer.role === ROLES.NURSE) {
        roleDesc.textContent = "من تريد أن تحمي من القتل هذه الليلة؟";
        createPlayerOptions(alivePlayers, actionContent, confirmBtn);
    } 
    else if (currentPlayer.role === ROLES.SNIPER) {
        if (sniperShotUsed) {
            roleDesc.textContent = "لقد استنفدت رصاصتك الوحيدة مسبقاً 🚫";
            createSkipOption(actionContent, confirmBtn);
        } else {
            roleDesc.textContent = "لديك رصاصة واحدة! يمكنك قتل لاعب أو التخطي. (تحذير: إذا قتلت مواطناً، ستموت أنت!)";
            createPlayerOptions(alivePlayers.filter(p => p.name !== currentPlayer.name), actionContent, confirmBtn, true);
        }
    } 
    else if (currentPlayer.role === ROLES.CITIZEN) {
        roleDesc.textContent = "أنت مواطن صالح. حل هذه المسألة ليمر الوقت دون إثارة الشبهات:";
        createMathProblem(actionContent, confirmBtn);
    }

    showScreen('action');
}

// دالة مساعدة لإنشاء أزرار الاختيار (للقائمة)
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
    skipBtn.textContent = 'تخطي (لا أريد فعل شيء)';
    skipBtn.onclick = () => {
        document.querySelectorAll('#action-content .option-btn').forEach(b => b.classList.remove('selected'));
        skipBtn.classList.add('selected');
        selectedOption = 'SKIP';
        confirmBtn.classList.remove('hidden');
    };
    container.appendChild(skipBtn);
}

// دالة المواطن العادي (مسألة حسابية)
function createMathProblem(container, confirmBtn) {
    const num1 = Math.floor(Math.random() * 10) + 1;
    const num2 = Math.floor(Math.random() * 10) + 1;
    const correctAns = num1 + num2;
    
    const problemText = document.createElement('h3');
    problemText.textContent = `${num1} + ${num2} = ؟`;
    problemText.style.textAlign = 'center';
    container.appendChild(problemText);

    let answers = [correctAns, correctAns + 1, correctAns - 1, correctAns + 2];
    answers = answers.sort(() => Math.random() - 0.5); // خلط الإجابات

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
            } else {
                alert('إجابة خاطئة! ركز قليلاً 👨‍🌾');
            }
        };
        container.appendChild(btn);
    });
}

// تأكيد قرار الليل والانتقال للاعب التالي
document.getElementById('confirm-action-btn').addEventListener('click', () => {
    const currentPlayer = alivePlayers[currentTurnIndex];
    
    if (currentPlayer.role === ROLES.MAFIA && selectedOption !== 'SKIP') nightActions.mafiaTarget = selectedOption;
    if (currentPlayer.role === ROLES.NURSE && selectedOption !== 'SKIP') nightActions.nurseTarget = selectedOption;
    if (currentPlayer.role === ROLES.SNIPER && selectedOption !== 'SKIP') {
        nightActions.sniperTarget = selectedOption;
        sniperShotUsed = true;
    }

    currentTurnIndex++;
    nextTurn();
});


/* ========================================================
   6. معالجة نتائج الليل وشاشة الصباح
======================================================== */
function processNightResults() {
    let deadThisNight = [];
    let newsMessage = "";

    // 1. هل مات هدف المافيا؟
    if (nightActions.mafiaTarget) {
        if (nightActions.mafiaTarget !== nightActions.nurseTarget) {
            deadThisNight.push(nightActions.mafiaTarget);
            newsMessage += `تم العثور على 💀 ${nightActions.mafiaTarget} مقتولاً في ظروف غامضة.<br>`;
        } else {
            newsMessage += `حاولت المافيا القتل، لكن الممرضة 💊 تدخلت في الوقت المناسب وأنقذت الضحية!<br>`;
        }
    }

    // 2. ماذا فعل القناص؟
    if (nightActions.sniperTarget && nightActions.sniperTarget !== 'SKIP') {
        const targetPlayer = players.find(p => p.name === nightActions.sniperTarget);
        const sniperPlayer = players.find(p => p.role === ROLES.SNIPER);

        if (targetPlayer.role === ROLES.MAFIA) {
            if (nightActions.sniperTarget !== nightActions.nurseTarget && !deadThisNight.includes(targetPlayer.name)) {
                deadThisNight.push(targetPlayer.name);
                newsMessage += `سُمع صوت رصاصة في الليل! 🎯 القناص قضى على المافيا ${targetPlayer.name}.<br>`;
            }
        } else {
            // القناص أخطأ وقتل بريئاً -> القناص يموت
            if (sniperPlayer && !deadThisNight.includes(sniperPlayer.name)) {
                deadThisNight.push(sniperPlayer.name);
                newsMessage += `أخطأ القناص 🎯 هدفه وصوب على شخص بريء، مما أدى إلى انتحاره لشعوره بالعار!<br>`;
            }
        }
    }

    // تحديث حالة اللاعبين
    deadThisNight.forEach(deadName => {
        const p = players.find(p => p.name === deadName);
        if (p) p.isAlive = false;
    });

    if (deadThisNight.length === 0) {
        newsMessage = "مرت الليلة بسلام، ولم يمت أحد! 🌅";
    }

    document.getElementById('morning-news').innerHTML = newsMessage;
    showScreen('morning');

    // التحقق من الفوز
    if (checkWinCondition()) return; 
}


/* ========================================================
   7. مرحلة النهار (التصويت)
======================================================== */
document.getElementById('start-voting-phase-btn').addEventListener('click', () => {
    startVotingPhase();
});

function startVotingPhase() {
    currentPhase = 'DAY';
    alivePlayers = players.filter(p => p.isAlive);
    currentTurnIndex = 0;
    votes = {}; // تصفير الأصوات
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

    // لا يمكن للاعب التصويت لنفسه
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

    // خيار الامتناع عن التصويت
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
    if (selectedOption !== 'SKIP') {
        votes[selectedOption]++;
    }
    
    currentTurnIndex++;
    if (currentTurnIndex < alivePlayers.length) {
        nextTurn();
    } else {
        processVotingResults();
    }
});

function processVotingResults() {
    let maxVotes = 0;
    let candidates = [];

    // البحث عن أعلى أصوات
    for (const [name, count] of Object.entries(votes)) {
        if (count > maxVotes) {
            maxVotes = count;
            candidates = [name];
        } else if (count === maxVotes && count > 0) {
            candidates.push(name);
        }
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
        newsElement.innerHTML = `بناءً على تصويت الأغلبية، تم إعدام 🪢 ${executedPlayer}.<br>كان دوره: ${players[pIndex].role}.`;
        continueBtn.classList.remove('hidden');
    }

    showScreen('votingResults');
    if (checkWinCondition()) return;
}

document.getElementById('continue-to-night-btn').addEventListener('click', startNightPhase);
document.getElementById('revote-btn').addEventListener('click', startVotingPhase);


/* ========================================================
   8. شروط الفوز وإدارة نهاية اللعبة
======================================================== */
function checkWinCondition() {
    const aliveMafs = players.filter(p => p.isAlive && p.role === ROLES.MAFIA).length;
    const aliveGoodGuys = players.filter(p => p.isAlive && p.role !== ROLES.MAFIA).length;

    if (aliveMafs === 0) {
        endGame('المواطنين الطيبين 👨‍🌾🎉');
        return true;
    } else if (aliveMafs >= aliveGoodGuys) {
        endGame('المافيا الأشرار 🔪💀');
        return true;
    }
    return false; // اللعبة مستمرة
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

// زر إعادة اللعب
document.getElementById('restart-btn').addEventListener('click', () => {
    // تصفير كامل لإعدادات اللعبة
    players = [];
    playersList.innerHTML = '';
    updatePlayerCount();
    sniperShotUsed = false;
    showScreen('setup');
});
