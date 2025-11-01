"use client";

import { GoogleGenAI } from "@google/genai";
import React, { useState } from "react";

export default function Home() {
  const [prompt, setPrompt] = useState("Write a story about a magic backpack.");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setResult("");

    try {
      // Per guidelines, initialize GoogleGenAI with the API key from process.env
      const ai = new GoogleGenAI({apiKey: process.env.API_KEY});

      // Per guidelines, use ai.models.generateContent for text tasks.
      // For basic text tasks, 'gemini-2.5-flash' is recommended.
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });

      // Per guidelines, access the text directly from response.text
      const text = response.text;
      setResult(text);
    } catch (e: any) {
      setError(e.message || "An error occurred while generating content.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '768px', margin: '0 auto', padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
      <header style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <h1>Gemini API Text Generation</h1>
        <p>Enter a prompt below and see what Gemini can do!</p>
      </header>

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="prompt" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
            Your Prompt
          </label>
          <textarea
            id="prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={5}
            placeholder="e.g., Why is the sky blue?"
            style={{ 
              width: '100%', 
              padding: '0.75rem', 
              fontSize: '1rem', 
              border: '1px solid #ccc', 
              borderRadius: '8px',
              boxSizing: 'border-box'
            }}
          />
        </div>
        
        <button 
          type="submit" 
          disabled={loading || !prompt} 
          style={{ 
            width: '100%', 
            padding: '0.75rem', 
            fontSize: '1rem', 
            backgroundColor: loading || !prompt ? '#ccc' : '#007bff', 
            color: 'white', 
            border: 'none', 
            borderRadius: '8px', 
            cursor: loading || !prompt ? 'not-allowed' : 'pointer' 
          }}
        >
          {loading ? "Generating..." : "Generate"}
        </button>
      </form>

      {error && (
        <div style={{ color: 'red', marginTop: '1rem', padding: '1rem', border: '1px solid red', borderRadius: '8px' }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {result && (
        <div style={{ marginTop: '2rem', whiteSpace: 'pre-wrap', border: '1px solid #eee', borderRadius: '8px', padding: '1.5rem', backgroundColor: '#f9f9f9' }}>
          <h2>Generated Response</h2>
          <p>{result}</p>
        </div>
      )}
    </div>
  );
}
