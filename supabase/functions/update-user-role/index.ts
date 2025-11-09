// FIX: Replaced placeholder with a complete and secure Supabase Edge Function.
// FIX: Removed broken Deno DTS import to fix deployment failure.
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
    // 1. Initialize a Supabase client to authenticate the invoking user.
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
      
    // 3. Extract the target user ID and the new role from the request body.
    const { user_id: targetUserId, new_role: newRole } = await req.json();
    if (!targetUserId || !newRole) {
      throw new Error('user_id and new_role are required.');
    }

    if (newRole !== 'admin' && newRole !== 'employee') {
        throw new Error('Invalid role specified. Can only be "admin" or "employee".');
    }

    // A user cannot change their own role.
    if (user.id === targetUserId) {
        return new Response(JSON.stringify({ error: 'You cannot change your own role.' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        });
    }

    // 4. Initialize the Supabase admin client to perform privileged operations.
    const supabaseAdmin = createClient(
      DenoEnv.get('SUPABASE_URL') ?? '',
      DenoEnv.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
      
    // 5. Verify the invoking user's role to ensure they have permission.
    const { data: adminProfile, error: adminError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (adminError || !adminProfile) {
      throw new Error('Could not verify admin privileges.');
    }
    
    // 6. Retrieve the target user's current role for hierarchy checks.
    const { data: targetUserProfile, error: targetUserError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', targetUserId)
      .single();

    if (targetUserError || !targetUserProfile) {
      return new Response(JSON.stringify({ error: 'Target user profile not found.' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 404,
      });
    }
    
    // 7. Enforce role-based update rules.
    if (adminProfile.role === 'admin' && (targetUserProfile.role !== 'employee' && targetUserProfile.role !== 'admin')) {
        return new Response(JSON.stringify({ error: 'Admins can only manage employees.' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 403,
        });
    } else if (adminProfile.role === 'super_admin') {
        if (targetUserProfile.role === 'super_admin') {
            return new Response(JSON.stringify({ error: 'Super admins cannot change roles of other super admins.' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 403,
            });
        }
    } else if (adminProfile.role === 'employee') {
        return new Response(JSON.stringify({ error: 'Insufficient permissions.' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 403,
        });
    }

    // 8. Update the user's role in the 'profiles' table.
    const { error: profileUpdateError } = await supabaseAdmin
      .from('profiles')
      .update({ role: newRole })
      .eq('id', targetUserId);

    if (profileUpdateError) {
      throw profileUpdateError;
    }

    // 9. Update the user's role in their auth metadata. This is crucial for RLS policies
    // and for the role to be reflected in the JWT.
    const { error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(
      targetUserId,
      { app_metadata: { role: newRole } }
    );

    if (authUpdateError) {
      console.error(`Failed to update auth metadata for ${targetUserId}, but profile was updated. Manual sync needed.`);
      throw authUpdateError;
    }

    return new Response(JSON.stringify({ success: true, message: `User ${targetUserId}'s role updated to ${newRole}.` }), {
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