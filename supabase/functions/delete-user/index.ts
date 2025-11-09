// FIX: Replaced placeholder with a complete and secure Supabase Edge Function.
// FIX: Removed broken Deno DTS import to fix deployment failure.
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// FIX: Declare Deno to satisfy TypeScript type checker in non-Deno environments.
declare const Deno: any;

// Standard CORS headers for browser-based function invocation.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// FIX: Cast Deno to any to access the 'env' property. This is a workaround
// for type-checking environments where Deno's global types are not properly loaded.
const DenoEnv = (Deno as any).env;

serve(async (req: Request) => {
  // Handle CORS preflight request.
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 1. Initialize a Supabase client with the authorization header from the request.
    // This authenticates the user invoking the function.
    const supabaseClient = createClient(
      DenoEnv.get('SUPABASE_URL') ?? '',
      DenoEnv.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    // 2. Retrieve the authenticated user's data.
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated.');
    }

    // 3. Extract the user ID to be deleted from the request body.
    const { user_id: userIdToDelete } = await req.json();
    if (!userIdToDelete) {
      throw new Error('user_id to delete is required.');
    }
    
    // A user cannot delete their own account through this function.
    if (user.id === userIdToDelete) {
      return new Response(JSON.stringify({ error: 'You cannot delete your own account.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // 4. Initialize the Supabase admin client using the service role key to bypass RLS.
    const supabaseAdmin = createClient(
      DenoEnv.get('SUPABASE_URL') ?? '',
      DenoEnv.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
      
    // 5. Verify that the invoking user has admin privileges.
    const { data: adminProfile, error: adminError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (adminError || !adminProfile) {
      throw new Error('Could not verify admin privileges.');
    }

    if (adminProfile.role !== 'admin' && adminProfile.role !== 'super_admin') {
      return new Response(JSON.stringify({ error: 'Only admins can delete users.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      });
    }

    // 6. Get the role of the user to be deleted for hierarchy checks.
    const { data: userToDeleteProfile, error: userToDeleteError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', userIdToDelete)
      .single();

    if (userToDeleteError) {
        console.warn(`Attempt to delete user ${userIdToDelete} with no profile.`, userToDeleteError);
        return new Response(JSON.stringify({ error: 'User to be deleted has no profile or could not be found.' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 404,
        });
    }

    // 7. Enforce role-based deletion rules.
    if (adminProfile.role === 'admin' && userToDeleteProfile.role !== 'employee') {
       return new Response(JSON.stringify({ error: 'Admins can only delete employees.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      });
    }
    if (adminProfile.role === 'super_admin' && userToDeleteProfile.role === 'super_admin') {
        return new Response(JSON.stringify({ error: 'Super admins cannot delete other super admins.' }), {
         headers: { ...corsHeaders, 'Content-Type': 'application/json' },
         status: 403,
       });
     }

    // 8. Perform the deletion using the admin client. This will remove the user from 'auth.users'.
    // The associated profile should be removed by a 'ON DELETE CASCADE' foreign key constraint.
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userIdToDelete);

    if (deleteError) {
      throw deleteError;
    }

    return new Response(JSON.stringify({ success: true, message: `User ${userIdToDelete} deleted.` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});