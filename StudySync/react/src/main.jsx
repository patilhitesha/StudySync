import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import './react-style.css';

const STORAGE_KEY = 'studysync:v1';
const SAMPLE_QUESTIONS = [
	{ id: 'q1', text: 'What is the time complexity of binary search?', options: ['O(n)', 'O(log n)', 'O(n log n)', 'O(1)'], correctOption: 1, marks: 2, negativeMarks: 0.5 },
	{ id: 'q2', text: 'Which data structure uses LIFO order?', options: ['Queue', 'Stack', 'Heap', 'Graph'], correctOption: 1, marks: 2, negativeMarks: 0.5 },
	{ id: 'q3', text: 'HTTP status 404 means?', options: ['Server Error', 'Unauthorized', 'Not Found', 'Success'], correctOption: 2, marks: 1, negativeMarks: 0.5 },
];
const GRADING_SCALE = [
	{ min: 90, grade: 'A+', point: 10 }, { min: 80, grade: 'A', point: 9 },
	{ min: 70, grade: 'B+', point: 8 }, { min: 60, grade: 'B', point: 7 },
	{ min: 50, grade: 'C', point: 6 }, { min: 40, grade: 'D', point: 5 },
	{ min: 0, grade: 'F', point: 0 },
];
const NAV_ITEMS = [
	['dashboard', 'Dashboard'], ['rooms', 'Rooms'], ['notes', 'Notes'],
	['attendance', 'Attendance'], ['gpa', 'GPA calculator'], ['tests', 'MCQ tests'],
];

function emptyStore() {
	return { users: [], currentUserId: null, rooms: [], notes: [], attendance: [], tests: [], attempts: [] };
}

function readStore() {
	try {
		const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
		if (!saved || typeof saved !== 'object') return emptyStore();
		const state = { ...emptyStore(), ...saved };
		for (const key of ['users', 'rooms', 'notes', 'attendance', 'tests', 'attempts']) {
			if (!Array.isArray(state[key])) state[key] = [];
		}
		return state;
	} catch {
		return emptyStore();
	}
}

function makeId(prefix) {
	return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function passwordRules(password) {
	return {
		len: password.length >= 8,
		upper: /[A-Z]/.test(password),
		lower: /[a-z]/.test(password),
		digit: /[0-9]/.test(password),
		special: /[^A-Za-z0-9]/.test(password),
	};
}

async function hashPassword(password, salt = null) {
	const actualSalt = salt || [...crypto.getRandomValues(new Uint8Array(16))]
		.map((value) => value.toString(16).padStart(2, '0')).join('');
	const bytes = new TextEncoder().encode(`${actualSalt}:${password}`);
	const digest = await crypto.subtle.digest('SHA-256', bytes);
	const hash = [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');
	return { salt: actualSalt, hash };
}

function marksToGrade(marks) {
	if (!Number.isFinite(marks) || marks < 0 || marks > 100) {
		throw new Error('Marks must be a number from 0 to 100.');
	}
	return GRADING_SCALE.find((band) => marks >= band.min);
}

function attendancePercent(attended, total) {
	if (attended < 0 || total < 0) throw new Error('Values cannot be negative.');
	if (attended > total) throw new Error('Attended classes cannot exceed total classes.');
	return total === 0 ? 0 : Math.round((attended / total) * 10000) / 100;
}

function attendanceStatus(percent) {
	if (percent < 65) return 'critical';
	if (percent < 75) return 'watch';
	return 'good';
}

function evaluateQuiz(questions, answers) {
	let score = 0;
	let maxScore = 0;
	let correct = 0;
	let incorrect = 0;
	let unanswered = 0;
	for (const question of questions) {
		const marks = question.marks ?? 1;
		maxScore += marks;
		if (answers[question.id] == null) {
			unanswered += 1;
		} else if (answers[question.id] === question.correctOption) {
			correct += 1;
			score += marks;
		} else {
			incorrect += 1;
			score -= question.negativeMarks ?? 0;
		}
	}
	score = Math.max(0, score);
	return {
		score,
		maxScore,
		percentage: maxScore ? Math.round((score / maxScore) * 10000) / 100 : 0,
		correct,
		incorrect,
		unanswered,
	};
}

function Field({ label, ...props }) {
	return <label className="field"><span>{label}</span><input {...props} /></label>;
}

function Message({ children, kind = 'error' }) {
	return children ? <p className={`message ${kind}`} role="status">{children}</p> : null;
}

function Login({ users, onSignIn, onSignUp }) {
	const [mode, setMode] = useState('signin');
	const [name, setName] = useState('');
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [message, setMessage] = useState('');
	const [busy, setBusy] = useState(false);
	const rules = passwordRules(password);

	async function submit(event) {
		event.preventDefault();
		setMessage('');
		setBusy(true);
		try {
			const result = mode === 'signin'
				? await onSignIn(email, password)
				: await onSignUp(name, email, password);
			if (!result.ok) setMessage(result.message);
		} catch {
			setMessage('Could not access secure browser storage. Try opening the app on localhost.');
		} finally {
			setBusy(false);
		}
	}

	return (
		<div className="auth-layout">
			<section className="auth-intro">
				<div>
					<p className="eyebrow">YOUR STUDY WORKSPACE</p>
					<h1>Study<em>Sync</em></h1>
					<p className="intro-copy">Learn together. Track progress. Study smarter.</p>
				</div>
				<div className="auth-highlights"><span>Study rooms</span><span>Shared notes</span><span>Progress tools</span></div>
			</section>
			<form className="auth-panel" onSubmit={submit}>
				<div className="mode-switch" role="tablist" aria-label="Account action">
					<button type="button" className={mode === 'signin' ? 'selected' : ''} onClick={() => { setMode('signin'); setMessage(''); }}>Sign in</button>
					<button type="button" className={mode === 'signup' ? 'selected' : ''} onClick={() => { setMode('signup'); setMessage(''); }}>Create account</button>
				</div>
				<h2>{mode === 'signin' ? 'Welcome back' : 'Create your account'}</h2>
				<p className="muted">Your workspace data stays in this browser.</p>
				{mode === 'signup' && <Field label="Full name" value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" />}
				<Field label="Email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required />
				<Field label="Password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} required />
				{mode === 'signup' && <ul className="password-rules">{[
					['len', 'At least 8 characters'], ['upper', 'One uppercase letter'], ['lower', 'One lowercase letter'], ['digit', 'One number'], ['special', 'One special character'],
				].map(([key, text]) => <li className={rules[key] ? 'passed' : ''} key={key}>{text}</li>)}</ul>}
				<button className="primary-button" type="submit" disabled={busy}>{busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}</button>
				<Message>{message}</Message>
				{mode === 'signin' && users.length === 0 && <p className="muted first-account">New here? Create an account to get started.</p>}
			</form>
		</div>
	);
}

function Dashboard({ store, user, onNavigate }) {
	const rooms = store.rooms.filter((room) => room.memberIds.includes(user.id));
	const roomIds = new Set(rooms.map((room) => room.id));
	const notes = store.notes.filter((note) => roomIds.has(note.roomId));
	const attendance = store.attendance.filter((record) => record.userId === user.id);
	const totalAttended = attendance.reduce((sum, record) => sum + record.attended, 0);
	const totalClasses = attendance.reduce((sum, record) => sum + record.total, 0);
	const attempts = store.attempts.filter((attempt) => attempt.userId === user.id);
	const latestNotes = [...notes].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5);

	return <>
		<PageHeader title={`Welcome back, ${user.name.split(' ')[0]}`} subtitle="Here's where things stand today." />
		<div className="stats-grid">
			<Stat value={rooms.length} label="Rooms joined" />
			<Stat value={notes.length} label="Notes saved" />
			<Stat value={totalClasses ? `${attendancePercent(totalAttended, totalClasses)}%` : '—'} label="Overall attendance" />
			<Stat value={attempts.length} label="Tests attempted" />
		</div>
		<div className="content-grid">
			<section className="panel"><h2>Recent notes</h2><p className="muted">Latest across your rooms</p>
				{latestNotes.length ? <ul className="item-list">{latestNotes.map((note) => <li key={note.id}><strong>{note.title}</strong><span>{rooms.find((room) => room.id === note.roomId)?.name || 'Study room'}</span></li>)}</ul> : <Empty>No notes yet. <button className="text-button" onClick={() => onNavigate('notes')}>Add one from Notes.</button></Empty>}
			</section>
			<section className="panel"><h2>Your rooms</h2><p className="muted">Jump back in</p>
				{rooms.length ? <ul className="item-list">{rooms.slice(0, 5).map((room) => <li key={room.id}><strong>{room.name}</strong><span>{room.subject} · code <code>{room.code}</code></span></li>)}</ul> : <Empty>No rooms yet. <button className="text-button" onClick={() => onNavigate('rooms')}>Create or join a room.</button></Empty>}
			</section>
		</div>
	</>;
}

function Stat({ value, label }) {
	return <div className="stat"><strong>{value}</strong><span>{label}</span></div>;
}

function PageHeader({ title, subtitle }) {
	return <header className="page-header"><h1>{title}</h1><p>{subtitle}</p></header>;
}

function Empty({ children }) {
	return <p className="empty-state">{children}</p>;
}

function RoomsPage({ rooms, user, onCreate, onJoin }) {
	const [name, setName] = useState('');
	const [subject, setSubject] = useState('');
	const [description, setDescription] = useState('');
	const [code, setCode] = useState('');
	const [createMessage, setCreateMessage] = useState('');
	const [joinMessage, setJoinMessage] = useState('');

	function create(event) {
		event.preventDefault();
		const result = onCreate({ name, subject, description });
		setCreateMessage(result.message);
		if (result.ok) { setName(''); setSubject(''); setDescription(''); }
	}

	function join(event) {
		event.preventDefault();
		const result = onJoin(code);
		setJoinMessage(result.message);
		if (result.ok) setCode('');
	}

	return <>
		<PageHeader title="Study rooms" subtitle="Create a room or join one with a classmate's code." />
		<div className="content-grid">
			<form className="panel form-stack" onSubmit={create}><h2>Create a room</h2><p className="muted">Set up a shared space for a subject.</p>
				<Field label="Room name" value={name} onChange={(event) => setName(event.target.value)} placeholder="DSA Warriors" required />
				<Field label="Subject" value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Computer Science" required />
				<label className="field"><span>Description (optional)</span><textarea rows="3" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Exam prep group" /></label>
				<button className="primary-button">Create room</button><Message kind={createMessage.startsWith('Room created') ? 'success' : 'error'}>{createMessage}</Message>
			</form>
			<form className="panel form-stack" onSubmit={join}><h2>Join a room</h2><p className="muted">Enter an invite code from a classmate.</p>
				<Field label="Room code" value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder="AB3X7Q" maxLength={6} required />
				<button className="secondary-button">Join room</button><Message kind={joinMessage.startsWith('Joined') ? 'success' : 'error'}>{joinMessage}</Message>
			</form>
		</div>
		<section className="panel section-gap"><h2>My rooms</h2>
			{rooms.length ? <ul className="room-list">{rooms.map((room) => <li key={room.id}><div><strong>{room.name}</strong><span>{room.subject} · {room.memberIds.length} member{room.memberIds.length === 1 ? '' : 's'}{room.ownerId === user.id ? ' · you own this' : ''}</span></div><code>{room.code}</code></li>)}</ul> : <Empty>No rooms yet.</Empty>}
		</section>
	</>;
}

function NotesPage({ rooms, notes, user, onAdd }) {
	const [roomId, setRoomId] = useState(rooms[0]?.id || '');
	const [title, setTitle] = useState('');
	const [content, setContent] = useState('');
	const [message, setMessage] = useState('');
	const visibleNotes = notes.filter((note) => note.roomId === roomId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

	function submit(event) {
		event.preventDefault();
		const result = onAdd({ roomId, title, content, userId: user.id });
		setMessage(result.message);
		if (result.ok) { setTitle(''); setContent(''); }
	}

	return <>
		<PageHeader title="Notes" subtitle="Keep useful notes organized by study room." />
		<form className="panel form-stack" onSubmit={submit}><h2>Add a note</h2>
			<label className="field"><span>Room</span><select value={roomId} onChange={(event) => setRoomId(event.target.value)} required disabled={!rooms.length}>{rooms.map((room) => <option value={room.id} key={room.id}>{room.name}</option>)}</select></label>
			<Field label="Title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Binary Search Trees" required />
			<label className="field"><span>Content</span><textarea rows="4" value={content} onChange={(event) => setContent(event.target.value)} placeholder="Key properties, complexity, examples…" /></label>
			<button className="primary-button" disabled={!rooms.length}>Save note</button>
			<Message kind={message === 'Note saved.' ? 'success' : 'error'}>{message || (!rooms.length ? 'Create or join a room before adding notes.' : '')}</Message>
		</form>
		<section className="panel section-gap"><h2>Room notes</h2>
			{visibleNotes.length ? <ul className="item-list">{visibleNotes.map((note) => <li key={note.id}><strong>{note.title}</strong><p>{note.content || 'No note content.'}</p></li>)}</ul> : <Empty>{rooms.length ? 'No notes in this room yet.' : 'Join a room to view its notes.'}</Empty>}
		</section>
	</>;
}

function AttendancePage({ records, onAdd }) {
	const [subject, setSubject] = useState('');
	const [attended, setAttended] = useState('');
	const [total, setTotal] = useState('');
	const [message, setMessage] = useState('');
	const totalAttended = records.reduce((sum, record) => sum + record.attended, 0);
	const totalClasses = records.reduce((sum, record) => sum + record.total, 0);
	const overall = totalClasses ? attendancePercent(totalAttended, totalClasses) : null;

	function submit(event) {
		event.preventDefault();
		const result = onAdd({ subject: subject.trim(), attended: Number(attended), total: Number(total) });
		setMessage(result.message);
		if (result.ok) { setSubject(''); setAttended(''); setTotal(''); }
	}

	return <>
		<PageHeader title="Attendance" subtitle="Log classes and track your percentage automatically." />
		<form className="panel form-stack" onSubmit={submit}><h2>Log a subject</h2>
			<div className="form-row"><Field label="Subject" value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Physics" required /><Field label="Attended" type="number" min="0" value={attended} onChange={(event) => setAttended(event.target.value)} required /><Field label="Total" type="number" min="0" value={total} onChange={(event) => setTotal(event.target.value)} required /></div>
			<button className="primary-button">Save attendance</button><Message kind={message === 'Attendance saved.' ? 'success' : 'error'}>{message}</Message>
		</form>
		<section className="panel section-gap"><h2>Overview</h2>
			{overall === null ? <Empty>Log a subject to see your overall attendance.</Empty> : <div className="attendance-overall"><strong>{overall}%</strong><span className={`status ${attendanceStatus(overall)}`}>{attendanceStatus(overall) === 'good' ? 'On track' : attendanceStatus(overall) === 'watch' ? 'Watch this' : 'Critical'}</span><div className="progress-track"><span style={{ width: `${overall}%` }} /></div></div>}
			{records.length ? <ul className="item-list">{records.map((record) => { const percent = attendancePercent(record.attended, record.total); return <li key={record.id}><strong>{record.subject}</strong><span>{record.attended}/{record.total} classes · <b className={`status-text ${attendanceStatus(percent)}`}>{percent}%</b></span></li>; })}</ul> : <Empty>No attendance logged yet.</Empty>}
		</section>
	</>;
}

function GpaPage() {
	const [input, setInput] = useState('Mathematics, 4, 88\nPhysics, 4, 76\nChemistry, 3, 65\nEnglish, 2, 91');
	const [result, setResult] = useState(null);
	const [error, setError] = useState('');

	function calculate(event) {
		event.preventDefault();
		setError('');
		try {
			const lines = input.split('\n').map((line) => line.trim()).filter(Boolean);
			const subjects = lines.map((line) => {
				const parts = line.split(',').map((part) => part.trim());
				if (parts.length !== 3 || !parts[0]) throw new Error('Use one subject per line: Name, Credits, Marks.');
				const subject = { name: parts[0], credits: Number(parts[1]), marks: Number(parts[2]) };
				if (!Number.isFinite(subject.credits) || subject.credits <= 0) throw new Error(`Enter positive credits for ${subject.name}.`);
				subject.band = marksToGrade(subject.marks);
				return subject;
			});
			if (!subjects.length) throw new Error('Add at least one subject.');
			const credits = subjects.reduce((sum, subject) => sum + subject.credits, 0);
			const sgpa = Math.round(subjects.reduce((sum, subject) => sum + subject.credits * subject.band.point, 0) / credits * 100) / 100;
			setResult({ sgpa, subjects });
		} catch (cause) {
			setResult(null);
			setError(cause.message);
		}
	}

	return <>
		<PageHeader title="GPA calculator" subtitle="Calculate a credit-weighted SGPA on a 10-point scale." />
		<form className="panel form-stack" onSubmit={calculate}><h2>Enter subjects</h2><p className="muted">One per line: <code>Name, Credits, Marks</code></p>
			<label className="field"><span>Subjects</span><textarea rows="7" value={input} onChange={(event) => setInput(event.target.value)} /></label>
			<button className="primary-button">Calculate SGPA</button><Message>{error}</Message>
			{result && <div className="gpa-result"><div className="gpa-score"><strong>{result.sgpa}</strong><span>SGPA</span></div><div className="table-scroll"><table><thead><tr><th>Subject</th><th>Credits</th><th>Marks</th><th>Grade</th></tr></thead><tbody>{result.subjects.map((subject) => <tr key={subject.name}><td>{subject.name}</td><td>{subject.credits}</td><td>{subject.marks}</td><td>{subject.band.grade}</td></tr>)}</tbody></table></div></div>}
		</form>
	</>;
}

function TestsPage({ rooms, tests, activeTest, onCreate, onSubmit }) {
	const [roomId, setRoomId] = useState(rooms[0]?.id || '');
	const [title, setTitle] = useState('');
	const [message, setMessage] = useState('');
	const [answers, setAnswers] = useState({});
	const [result, setResult] = useState(null);
	const [selectedTest, setSelectedTest] = useState(activeTest?.id || '');
	const currentTest = tests.find((test) => test.id === selectedTest) || activeTest;

	function create(event) {
		event.preventDefault();
		const outcome = onCreate({ roomId, title });
		setMessage(outcome.message);
		if (outcome.ok) { setTitle(''); setAnswers({}); setResult(null); setSelectedTest(outcome.test.id); }
	}

	function chooseTest(id) {
		setSelectedTest(id);
		setAnswers({});
		setResult(null);
	}

	function submit(event) {
		event.preventDefault();
		if (!currentTest) return;
		const outcome = onSubmit(currentTest, answers);
		setResult(outcome);
	}

	return <>
		<PageHeader title="MCQ tests" subtitle="Create a sample quiz and get instant scoring." />
		<form className="panel form-stack" onSubmit={create}><h2>Create a sample test</h2>
			<label className="field"><span>Room</span><select value={roomId} onChange={(event) => setRoomId(event.target.value)} required disabled={!rooms.length}>{rooms.map((room) => <option value={room.id} key={room.id}>{room.name}</option>)}</select></label>
			<Field label="Title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Chapter 3 Quiz" />
			<p className="muted">Three sample questions with 0.5-mark negative marking.</p>
			<button className="primary-button" disabled={!rooms.length}>Create test</button>
			<Message kind={message.startsWith('Test created') ? 'success' : 'error'}>{message || (!rooms.length ? 'Create or join a room before creating a test.' : '')}</Message>
		</form>
		<section className="panel section-gap"><div className="section-heading"><div><h2>Take a test</h2><p className="muted">Choose a test from one of your rooms.</p></div>
			{tests.length > 0 && <select aria-label="Select a test" value={currentTest?.id || ''} onChange={(event) => chooseTest(event.target.value)}>{tests.map((test) => <option value={test.id} key={test.id}>{test.title}</option>)}</select>}
		</div>
			{!currentTest ? <Empty>{tests.length ? 'Select a test to begin.' : 'Create a test above to begin.'}</Empty> : <form className="quiz-form" onSubmit={submit}>
				<h3>{currentTest.title}</h3>
				{currentTest.questions.map((question, index) => <fieldset className="question" key={`${currentTest.id}-${question.id}`}><legend>{index + 1}. {question.text}</legend>{question.options.map((option, optionIndex) => <label className="answer-option" key={option}><input type="radio" name={question.id} checked={answers[question.id] === optionIndex} onChange={() => setAnswers({ ...answers, [question.id]: optionIndex })} /><span>{option}</span></label>)}</fieldset>)}
				<button className="primary-button" disabled={Boolean(result)}>Submit answers</button>
				{result && <div className="quiz-result"><strong>{result.score}/{result.maxScore} · {result.percentage}%</strong><span>{result.correct} correct · {result.incorrect} incorrect · {result.unanswered} unanswered</span></div>}
			</form>}
		</section>
	</>;
}

function App() {
	const [store, setStore] = useState(readStore);
	const [tab, setTab] = useState('dashboard');
	const [activeTestId, setActiveTestId] = useState('');
	const [storageError, setStorageError] = useState('');
	const user = store.users.find((candidate) => candidate.id === store.currentUserId);

	function persist(nextStore) {
		setStore(nextStore);
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(nextStore));
			setStorageError('');
		} catch {
			setStorageError('Changes could not be saved in this browser.');
		}
	}

	async function signIn(emailValue, password) {
		const email = emailValue.trim().toLowerCase();
		const account = store.users.find((candidate) => candidate.email === email);
		if (!account) return { ok: false, message: 'No account found for that email. Create an account first.' };
		const { hash } = await hashPassword(password, account.salt);
		if (hash !== account.hash) return { ok: false, message: 'Incorrect password.' };
		persist({ ...store, currentUserId: account.id });
		setTab('dashboard');
		return { ok: true };
	}

	async function signUp(nameValue, emailValue, password) {
		const name = nameValue.trim() || 'Student';
		const email = emailValue.trim().toLowerCase();
		if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, message: 'Enter a valid email address.' };
		if (!Object.values(passwordRules(password)).every(Boolean)) return { ok: false, message: 'Password does not meet all the requirements.' };
		if (store.users.some((candidate) => candidate.email === email)) return { ok: false, message: 'An account with that email already exists.' };
		const { salt, hash } = await hashPassword(password);
		const account = { id: makeId('user'), name, email, salt, hash, createdAt: new Date().toISOString() };
		persist({ ...store, users: [...store.users, account], currentUserId: account.id });
		setTab('dashboard');
		return { ok: true };
	}

	function createRoom({ name, subject, description }) {
		if (!name.trim() || !subject.trim()) return { ok: false, message: 'Give the room a name and subject.' };
		const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
		let code = '';
		do {
			code = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
		} while (store.rooms.some((room) => room.code === code));
		const room = { id: makeId('room'), name: name.trim(), subject: subject.trim(), description: description.trim(), code, ownerId: user.id, memberIds: [user.id], createdAt: new Date().toISOString() };
		persist({ ...store, rooms: [...store.rooms, room] });
		return { ok: true, message: `Room created! Share this code: ${code}` };
	}

	function joinRoom(codeValue) {
		const code = codeValue.trim().toUpperCase();
		const room = store.rooms.find((candidate) => candidate.code === code);
		if (!room) return { ok: false, message: 'No room found for that code.' };
		if (room.memberIds.includes(user.id)) return { ok: true, message: `You already belong to ${room.name}.` };
		const rooms = store.rooms.map((candidate) => candidate.id === room.id ? { ...candidate, memberIds: [...candidate.memberIds, user.id] } : candidate);
		persist({ ...store, rooms });
		return { ok: true, message: `Joined “${room.name}”.` };
	}

	function addNote({ roomId, title, content, userId }) {
		if (!roomId) return { ok: false, message: 'Create or join a room first.' };
		if (!title.trim()) return { ok: false, message: 'Give the note a title.' };
		const note = { id: makeId('note'), roomId, authorId: userId, title: title.trim(), content: content.trim(), createdAt: new Date().toISOString() };
		persist({ ...store, notes: [...store.notes, note] });
		return { ok: true, message: 'Note saved.' };
	}

	function addAttendance({ subject, attended, total }) {
		if (!subject) return { ok: false, message: 'Enter a subject name.' };
		if (!Number.isInteger(attended) || !Number.isInteger(total)) return { ok: false, message: 'Enter whole numbers for classes attended and total.' };
		try { attendancePercent(attended, total); } catch (error) { return { ok: false, message: error.message }; }
		const record = { id: makeId('att'), userId: user.id, subject, attended, total };
		persist({ ...store, attendance: [...store.attendance, record] });
		return { ok: true, message: 'Attendance saved.' };
	}

	function createTest({ roomId, title }) {
		if (!roomId) return { ok: false, message: 'Create or join a room first.' };
		const test = { id: makeId('test'), roomId, title: title.trim() || 'Sample Quiz', questions: SAMPLE_QUESTIONS, createdAt: new Date().toISOString() };
		persist({ ...store, tests: [...store.tests, test] });
		setActiveTestId(test.id);
		return { ok: true, message: `Test created: ${test.title}`, test };
	}

	function submitTest(test, answers) {
		const result = evaluateQuiz(test.questions, answers);
		const attempt = { id: makeId('attempt'), testId: test.id, userId: user.id, result, submittedAt: new Date().toISOString() };
		persist({ ...store, attempts: [...store.attempts, attempt] });
		return result;
	}

	function logout() {
		persist({ ...store, currentUserId: null });
		setTab('dashboard');
		setActiveTestId('');
	}

	if (!user) return <><Login users={store.users} onSignIn={signIn} onSignUp={signUp} />{storageError && <div className="storage-warning">{storageError}</div>}</>;

	const rooms = store.rooms.filter((room) => room.memberIds.includes(user.id));
	const attendance = store.attendance.filter((record) => record.userId === user.id);
	const tests = store.tests.filter((test) => rooms.some((room) => room.id === test.roomId));
	const activeTest = tests.find((test) => test.id === activeTestId) || tests[tests.length - 1] || null;

	return <div className="app-shell">
		<aside className="sidebar">
			<a href="#dashboard" className="brand" onClick={(event) => { event.preventDefault(); setTab('dashboard'); }}><span className="brand-mark">S</span><span>StudySync</span></a>
			<nav aria-label="StudySync sections">{NAV_ITEMS.map(([id, label]) => <button key={id} className={`nav-button ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)} aria-current={tab === id ? 'page' : undefined}>{label}</button>)}</nav>
			<div className="account-area"><span className="account-label">SIGNED IN</span><strong>{user.name}</strong><span className="account-email">{user.email}</span><button className="logout-button" onClick={logout}>Sign out</button></div>
		</aside>
		<main className="main-content">
			{tab === 'dashboard' && <Dashboard store={store} user={user} onNavigate={setTab} />}
			{tab === 'rooms' && <RoomsPage rooms={rooms} user={user} onCreate={createRoom} onJoin={joinRoom} />}
			{tab === 'notes' && <NotesPage rooms={rooms} notes={store.notes.filter((note) => rooms.some((room) => room.id === note.roomId))} user={user} onAdd={addNote} />}
			{tab === 'attendance' && <AttendancePage records={attendance} onAdd={addAttendance} />}
			{tab === 'gpa' && <GpaPage />}
			{tab === 'tests' && <TestsPage key={activeTest?.id || 'tests'} rooms={rooms} tests={tests} activeTest={activeTest} onCreate={createTest} onSubmit={submitTest} />}
			{storageError && <div className="storage-warning">{storageError}</div>}
		</main>
	</div>;
}

createRoot(document.getElementById('root')).render(<App />);
