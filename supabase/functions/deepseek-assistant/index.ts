import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// FIX: Declare Deno to satisfy TypeScript type checker.
declare const Deno: any;

const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY");

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

serve(async (req)=>{
  // Trata a requisição OPTIONS (CORS preflight)
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: CORS_HEADERS
    });
  }

  try {
    const { messages, context, currentDate } = await req.json(); // Recebe a data atual do cliente

    if (!DEEPSEEK_API_KEY) {
      return new Response(JSON.stringify({
        error: "Chave da API DeepSeek não configurada como Secret no Supabase."
      }), {
        status: 500,
        headers: {
          ...CORS_HEADERS,
          "Content-Type": "application/json"
        }
      });
    }

    // Prompt do sistema aprimorado com instrução de fuso horário (UTC -> UTC-3)
    const systemPrompt = `Você é um assistente inteligente para agendamento. Sua tarefa é interpretar pedidos para criar agendamentos.
    - A data fornecida (${currentDate}) está em UTC. Antes de responder ou agendar, subtraia 3 horas para converter para o Horário de Brasília (UTC-3). Considere essa nova data convertida como o "agora".
    - Use esta data ajustada como ponto de partida para calcular datas relativas como "amanhã" ou "próxima sexta-feira". O ano atual é ${new Date(currentDate).getFullYear()}.
    - Siga estritamente as regras de negócio e os dados de contexto fornecidos.
    - Não invente informações. Se um horário não estiver disponível, informe o usuário e não sugira alternativas.
    - Responda de forma concisa em português do Brasil.

    Contexto de negócio e agendamentos:
    ${context}`;

    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          ...messages
        ],
        // Definição da função para a IA usar
        tools: [
          {
            type: "function",
            function: {
              name: "create_appointment",
              description: "Cria um novo agendamento para um cliente em uma data e hora específicas.",
              parameters: {
                type: "object",
                properties: {
                  name: {
                    type: "string",
                    description: "O nome completo do cliente."
                  },
                  date: {
                    type: "string",
                    description: "A data do agendamento no formato AAAA-MM-DD."
                  },
                  time: {
                    type: "string",
                    description: "A hora do agendamento no formato HH:MM (24 horas)."
                  },
                  phone: {
                    type: "string",
                    description: "O número de telefone do cliente, incluindo DDD. Somente números."
                  },
                  email: {
                    type: "string",
                    description: "O endereço de email do cliente (opcional)."
                  }
                },
                required: [
                  "name",
                  "date",
                  "time"
                ]
              }
            }
          }
        ],
        tool_choice: "auto"
      })
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("DeepSeek API Error:", errorBody);
      throw new Error(`Erro na API DeepSeek: ${response.statusText}`);
    }

    const data = await response.json();

    return new Response(JSON.stringify(data), {
      headers: {
        ...CORS_HEADERS,
        "Content-Type": "application/json"
      },
      status: 200
    });

  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({
      error: error.message
    }), {
      headers: {
        ...CORS_HEADERS,
        "Content-Type": "application/json"
      },
      status: 500
    });
  }
});