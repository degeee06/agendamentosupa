// Fix: The original file content was a placeholder string causing parsing errors.
// It has been replaced with a functional React component that demonstrates
// how to use the Gemini API for text generation according to the provided guidelines.

import React, { useState } from 'react';
import { GoogleGenAI } from "@google/genai";

const GeminiApp = () => {
    const [prompt, setPrompt] = useState('');
    const [response, setResponse] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const generateContent = async () => {
        if (!prompt) {
            setError('Please enter a prompt.');
            return;
        }

        setLoading(true);
        setError('');
        setResponse('');

        try {
            // As per the guidelines, the API key is sourced from environment variables.
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });

            const result = await ai.models.generateContent({
                model: 'gemini-2.5-flash', // Using gemini-2.5-flash for basic text tasks as per guidelines.
                contents: prompt,
            });

            // As per guidelines, accessing the text directly from the response object.
            setResponse(result.text);

        } catch (e) {
            if (e instanceof Error) {
                setError(e.message);
            } else {
                setError('An unexpected error occurred.');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ padding: '20px', fontFamily: 'sans-serif', maxWidth: '800px', margin: 'auto' }}>
            <h1>Gemini API Frontend Example</h1>
            <p>Enter a prompt below and click "Generate" to get a response from the Gemini API.</p>
            
            <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g., Why is the sky blue?"
                rows={5}
                style={{ width: '100%', boxSizing: 'border-box', padding: '10px', fontSize: '16px', borderRadius: '4px', border: '1px solid #ccc' }}
            />
            
            <button
                onClick={generateContent}
                disabled={loading}
                style={{ marginTop: '10px', padding: '10px 20px', fontSize: '16px', cursor: 'pointer', border: 'none', background: '#007bff', color: 'white', borderRadius: '4px' }}
            >
                {loading ? 'Generating...' : 'Generate'}
            </button>

            {error && (
                <div style={{ marginTop: '20px', color: 'red', border: '1px solid red', padding: '10px', borderRadius: '4px', background: '#ffeeee' }}>
                    <strong>Error:</strong> {error}
                </div>
            )}

            {response && (
                <div style={{ marginTop: '20px', border: '1px solid #eee', padding: '15px', borderRadius: '4px', background: '#f9f9f9' }}>
                    <h2>Response</h2>
                    <pre style={{ whiteSpace: 'pre-wrap', wordWrap: 'break-word', fontFamily: 'monospace' }}>
                        {response}
                    </pre>
                </div>
            )}
        </div>
    );
};

export default GeminiApp;
