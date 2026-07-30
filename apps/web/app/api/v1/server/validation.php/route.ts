import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Inicializar cliente admin de Supabase para validaciones internas
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mock.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'mock'
);

export async function POST(request: Request) {
  try {
    const input = await request.json();
    const email = (input.email || '').trim();
    const accessTokenPlugin = input.access_token_plugin || input.token || '';
    const chromeStoreID = input.chromeStoreID || '';

    if (!email) {
      return NextResponse.json({
        success: false,
        msg_id: "missing_fields",
        message: "email es requerido"
      });
    }

    // Buscar al usuario en Supabase
    const { data: users, error: userError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (userError) {
      console.error("Auth error:", userError);
      return NextResponse.json({
        success: false,
        msg_id: "db_connection_error",
        message: "Error de conexión con Auth"
      });
    }

    const authUser = users.users.find(u => u.email === email);

    if (!authUser) {
      return NextResponse.json({
        success: false,
        msg_id: "invalid_user",
        message: "Usuario no encontrado"
      });
    }

    // Buscamos si pertenece a algún workspace PRO
    const { data: members, error: memError } = await supabaseAdmin
      .from('workspace_members')
      .select('workspace_id, role, workspaces(plan, created_at)')
      .eq('user_id', authUser.id);

    let isPremium = false;
    let planType = 'free';
    
    if (members && members.length > 0) {
      const proWorkspace = members.find(m => 
        // @ts-ignore
        m.workspaces?.plan === 'pro' || m.workspaces?.plan === 'enterprise'
      );
      
      if (proWorkspace) {
        isPremium = true;
        // @ts-ignore
        planType = proWorkspace.workspaces.plan;
      }
    }

    // Simulamos ID de usuario y expiración
    const userStatus = isPremium ? "active" : "expired"; 
    const endDate = isPremium 
      ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      : new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const dataLiberacao = new Date().toISOString().split('T')[0];

    // Payload idéntico al de validation.php
    const responsePayload = {
      success: isPremium,
      msg_id: isPremium ? "validacao_successo" : "licenca_expirada",
      message: isPremium ? "OK" : "Licencia expirada",
      auth_google: { active: false, email_auth: null },
      user_status: userStatus,
      user: {
        id: 1, 
        user_id: 1,
        name: email,
        email: email,
        wl_id: chromeStoreID,
        license_key: `SPB-${authUser.id}`,
        end_date: endDate,
        plan_type: planType,
        bearer_token: "",
        access_token_plugin: accessTokenPlugin,
        user_premium: isPremium,
        dataCadastro: dataLiberacao,
        whatsapp_registro: "",
        whatsapp_plugin: "",
        path: "",
        afiliado: "",
        campanhaID: "",
        start_form: false,
        cookies: {
          "_fbc": "", "_fbp": "", "_ga": "", "_ttclid": "", "_ttp": "",
        }
      }
    };

    return NextResponse.json(responsePayload, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, access-token, Access-Token, accept'
      }
    });

  } catch (error) {
    console.error("Validation API error:", error);
    return NextResponse.json({ success: false, message: "Server error" }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, access-token, Access-Token, accept'
    }
  });
}
