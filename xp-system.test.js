const assert = require('assert');
const ProfileXP = require('./profile-xp.js');

function createStorage(initialEntries = {}) {
    const store = new Map(Object.entries(initialEntries));

    return {
        get length() {
            return store.size;
        },
        key(index) {
            return Array.from(store.keys())[index] || null;
        },
        getItem(key) {
            return store.has(key) ? store.get(key) : null;
        },
        setItem(key, value) {
            store.set(key, String(value));
        }
    };
}

function testLevelBoundaries() {
    assert.strictEqual(ProfileXP.getLevelFromXP(0), 0);
    assert.strictEqual(ProfileXP.getLevelFromXP(99), 0);
    assert.strictEqual(ProfileXP.getLevelFromXP(100), 1);
    assert.strictEqual(ProfileXP.getLevelFromXP(199), 1);
    assert.strictEqual(ProfileXP.getLevelFromXP(200), 2);
    assert.strictEqual(ProfileXP.getLevelFromXP(300), 3);
}

function testQuizFlowAccumulation() {
    const storage = createStorage();
    const user = { uid: 'student-1', email: 'student@example.com' };
    const quizSource = ProfileXP.buildRewardSource('quiz', 'photosynthesis:luz-vira-energia');

    const firstReward = ProfileXP.awardXPToUser(user, 60, quizSource, storage);
    const secondReward = ProfileXP.awardXPToUser(user, 60, quizSource, storage);
    const profile = ProfileXP.readProfile(storage, user);

    assert.strictEqual(firstReward.awarded, true);
    assert.strictEqual(firstReward.xpAdded, 60);
    assert.strictEqual(secondReward.awarded, false);
    assert.strictEqual(profile.xp, 60);
}

function testChallengeFlowAccumulation() {
    const storage = createStorage();
    const user = { uid: 'student-2', email: 'challenge@example.com' };
    const challengeSource = ProfileXP.buildRewardSource('challenge', 'photosynthesis-goldtest');

    const reward = ProfileXP.awardXPToUser(user, 85, challengeSource, storage);
    const duplicateReward = ProfileXP.awardXPToUser(user, 85, challengeSource, storage);
    const profile = ProfileXP.readProfile(storage, user);

    assert.strictEqual(reward.awarded, true);
    assert.strictEqual(reward.xpAdded, 85);
    assert.strictEqual(duplicateReward.awarded, false);
    assert.strictEqual(profile.xp, 85);
}

function testLegacyMissionMigration() {
    const user = { uid: 'student-3', email: 'legacy@example.com' };
    const storage = createStorage({
        'mission_uid:student-3_photosynthesis': JSON.stringify({ earnedXP: 190 }),
        'mission_email:legacy@example.com_biology': JSON.stringify({ earnedXP: 75 })
    });

    const profile = ProfileXP.readProfile(storage, user);
    const savedProfile = JSON.parse(storage.getItem(ProfileXP.getProfileStorageKey(user)));

    assert.strictEqual(profile.xp, 265);
    assert.strictEqual(savedProfile.migrations.legacyMissionXpImported, true);
}

function testLegacyMissionMigrationIsolationByUser() {
    const user = { uid: 'student-6', email: 'isolated@example.com' };
    const storage = createStorage({
        'mission_uid:student-6_photosynthesis': JSON.stringify({ earnedXP: 120 }),
        'mission_uid:other-user_photosynthesis': JSON.stringify({ earnedXP: 500 }),
        mission_photosynthesis: JSON.stringify({ earnedXP: 900 })
    });

    const profile = ProfileXP.readProfile(storage, user);

    assert.strictEqual(profile.xp, 120);
}

function testCurrentUserProfileAccess() {
    const user = { uid: 'student-4', email: 'current@example.com' };
    const storage = createStorage();

    global.window = {
        exploreCurrentUser: user
    };
    global.localStorage = storage;

    const reward = ProfileXP.awardXPToCurrentUser(100, ProfileXP.buildRewardSource('quiz', 'current-user:quiz'));
    const profile = ProfileXP.getCurrentUserProfile();

    assert.strictEqual(reward.awarded, true);
    assert.strictEqual(profile.xp, 100);

    delete global.window;
    delete global.localStorage;
}

function testBadgeUnlockAndSafeDefaults() {
    const user = { uid: 'student-5', email: 'badges@example.com' };
    const storage = createStorage();

    const defaultProfile = ProfileXP.readProfile(storage, user);
    assert.deepStrictEqual(
        ProfileXP.getBadgeCatalog(defaultProfile).map((badge) => badge.unlocked),
        [false, false, false]
    );

    const photosynthesisSource = ProfileXP.buildRewardSource('challenge', 'photosynthesis-goldtest');
    const photosynthesisResult = ProfileXP.awardXPToUser(user, 50, photosynthesisSource, storage);
    const dnaSource = ProfileXP.buildRewardSource('quiz', 'dna:code-of-life');
    const dnaResult = ProfileXP.unlockBadgesForUser(user, dnaSource, storage);
    const profile = ProfileXP.readProfile(storage, user);
    const badges = ProfileXP.getBadgeCatalog(profile);

    assert.deepStrictEqual(photosynthesisResult.unlockedBadges, ['photosynthesis']);
    assert.deepStrictEqual(dnaResult.unlockedBadges, ['dna']);
    assert.strictEqual(badges.find((badge) => badge.id === 'photosynthesis').unlocked, true);
    assert.strictEqual(badges.find((badge) => badge.id === 'dna').unlocked, true);
    assert.strictEqual(badges.find((badge) => badge.id === 'mitosis').unlocked, false);
}

function testProfileOverview() {
    const profile = {
        xp: 220,
        awardedSources: {
            'challenge:photosynthesis-goldtest': true,
            'quiz:dna:code-of-life': true
        },
        badges: {
            photosynthesis: { unlocked: true },
            dna: { unlocked: true }
        }
    };
    const overview = ProfileXP.getProfileOverview(profile);

    assert.strictEqual(overview.stats.level, 2);
    assert.strictEqual(overview.stats.xp, 220);
    assert.strictEqual(overview.rank, 'Explorador');
    assert.strictEqual(overview.currentSubject, 'DNA');
    assert.ok(overview.remainingUnlockables.some((item) => item.label.includes('Investigador')));
    assert.ok(overview.remainingUnlockables.some((item) => item.label.includes('Mitose')));
}

function testLevelResetIsolation() {
    const primary = { uid: 'student-7', email: 'reset-a@example.com' };
    const secondary = { uid: 'student-8', email: 'reset-b@example.com' };
    const storage = createStorage();

    ProfileXP.awardXPToUser(primary, 250, ProfileXP.buildRewardSource('quiz', 'photosynthesis:luz-vira-energia'), storage);
    ProfileXP.awardXPToUser(secondary, 120, ProfileXP.buildRewardSource('quiz', 'dna:code-of-life'), storage);
    ProfileXP.unlockBadgesForUser(primary, ProfileXP.buildRewardSource('challenge', 'photosynthesis-goldtest'), storage);

    const resetResult = ProfileXP.resetLevelForUser(primary, storage);
    const primaryAfterReset = ProfileXP.readProfile(storage, primary);
    const secondaryAfterReset = ProfileXP.readProfile(storage, secondary);

    assert.strictEqual(resetResult.reset, true);
    assert.strictEqual(primaryAfterReset.xp, 0);
    assert.strictEqual(primaryAfterReset.badges.photosynthesis.unlocked, true);
    assert.strictEqual(secondaryAfterReset.xp, 120);
}

function run() {
    testLevelBoundaries();
    testQuizFlowAccumulation();
    testChallengeFlowAccumulation();
    testLegacyMissionMigration();
    testLegacyMissionMigrationIsolationByUser();
    testCurrentUserProfileAccess();
    testBadgeUnlockAndSafeDefaults();
    testProfileOverview();
    testLevelResetIsolation();
    console.log('XP system validation passed.');
}

run();
