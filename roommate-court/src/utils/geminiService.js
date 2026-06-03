import { getAI, getGenerativeModel, GoogleAIBackend } from 'firebase/ai';
import { app } from '../firebase';

const DEFAULT_MODEL = 'gemini-3.5-flash';

function buildOpinionPrompt({ caseTitle, plaintiffName, defendantName, householdSeverity, verdictCounts, totalVoters }) {
	return [
		'You are an impartial roommate court advisor.',
		'Provide a concise opinion on the likely outcome of this roommate case.',
		'Use a respectful, practical tone and do not mention policy or hidden reasoning.',
		'Focus on the household sentencing severity when recommending how strict the outcome should be.',
		'',
		`Case title: ${caseTitle}`,
		`Plaintiff: ${plaintiffName}`,
		`Defendant(s): ${defendantName}`,
		`Household sentencing severity: ${householdSeverity}`,
		`Current jury tally: Guilty ${verdictCounts.guilty}, Not Guilty ${verdictCounts.not_guilty}, No Fault ${verdictCounts.no_fault}`,
		`Total voters: ${totalVoters}`,
		'',
		'Return 3 short paragraphs or bullet-like sentences with:',
		'1. A likely verdict direction.',
		'2. A brief explanation tied to the severity level.',
		'3. A practical next step for the roommates.'
	].join('\n');
}

export async function generateJuryOpinion({
	caseTitle,
	plaintiffName,
	defendantName,
	householdSeverity,
	verdictCounts,
	totalVoters,
	model = DEFAULT_MODEL,
}) {
	const prompt = buildOpinionPrompt({
		caseTitle,
		plaintiffName,
		defendantName,
		householdSeverity,
		verdictCounts,
		totalVoters,
	});

	const ai = getAI(app, { backend: new GoogleAIBackend() });
	const generativeModel = getGenerativeModel(ai, { model });
	const result = await generativeModel.generateContent(prompt);
	const text = result?.response?.text?.()?.trim();

	if (!text) {
		throw new Error('Gemini returned an empty opinion.');
	}

	return text;
}